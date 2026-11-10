#!/usr/bin/env python3
"""Render a complete Urdu anime-style mystery documentary with original assets.

Usage (from repository root):
  .venv/bin/python mystery-anime/scripts/build.py --preview
  .venv/bin/python mystery-anime/scripts/build.py --build
"""
from __future__ import annotations

import argparse
import math
import re
import subprocess
import sys
import time
import wave
from pathlib import Path

import arabic_reshaper
import imageio_ffmpeg
import numpy as np
from bidi.algorithm import get_display
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

from story import (
    CREDIT,
    DISCLAIMER,
    END_CARD_SECONDS,
    END_QUOTE,
    ENGLISH_TITLE,
    SCENES,
    TITLE,
    VALLEY,
)

ROOT = Path(__file__).resolve().parents[1]
SCENE_DIR = ROOT / "assets" / "scenes"
AUDIO_DIR = ROOT / "audio" / "narration"
FONT_DIR = ROOT / "assets" / "fonts"
WORK = ROOT / "work"
OUTPUT = ROOT / "output"
W, H = 1280, 720
FPS = 24
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
RESAMPLE = Image.Resampling.BICUBIC


def clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def smooth(x: float) -> float:
    x = clamp(x)
    return x * x * (3.0 - 2.0 * x)


def fade_window(t: float, start: float, end: float, edge: float = 0.25) -> float:
    if t < start or t > end:
        return 0.0
    return min(smooth((t - start) / edge), smooth((end - t) / edge))


def ur(text: str) -> str:
    return get_display(arabic_reshaper.reshape(text))


def font(path: Path, size: int, weight: int = 400) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(path), size=size)
    try:
        f.set_variation_by_axes([weight])
    except Exception:
        pass
    return f


def audio_duration(path: Path) -> float:
    p = subprocess.run(
        [FFMPEG, "-hide_banner", "-i", str(path)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
        check=False,
    )
    m = re.search(r"Duration: (\d+):(\d+):(\d+(?:\.\d+)?)", p.stderr)
    if not m:
        raise RuntimeError(f"Could not read audio duration: {path}")
    h, mnt, sec = m.groups()
    return int(h) * 3600 + int(mnt) * 60 + float(sec)


def srt_time(t: float) -> str:
    ms = max(0, round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


class Film:
    def __init__(self) -> None:
        WORK.mkdir(parents=True, exist_ok=True)
        OUTPUT.mkdir(parents=True, exist_ok=True)
        self.naskh = FONT_DIR / "NotoNaskhArabic.ttf"
        self.nastaliq = FONT_DIR / "NotoNastaliqUrdu.ttf"
        self.latin = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
        self.mono = Path("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf")
        self.f_sub = font(self.naskh, 37, 500)
        self.f_hud = font(self.naskh, 22, 500)
        # Noto Naskh contains all shaped Urdu presentation forms used by the
        # renderer. The variable Nastaliq build lacks several of them in PIL.
        self.f_chapter = font(self.naskh, 38, 600)
        self.f_title = font(self.naskh, 67, 700)
        self.f_end = font(self.naskh, 52, 600)
        self.f_small_ur = font(self.naskh, 23, 500)
        self.f_latin = font(self.latin, 18, 400)
        self.f_latin_small = font(self.mono, 13, 400)
        self.f_latin_title = font(self.latin, 20, 400)
        self.images: list[Image.Image] = []
        for scene in SCENES:
            im = Image.open(SCENE_DIR / scene["image"]).convert("RGB")
            im = ImageEnhance.Contrast(im).enhance(1.055)
            im = ImageEnhance.Color(im).enhance(0.94)
            self.images.append(im)
        self.timeline: list[dict] = []
        self.captions: list[dict] = []
        self._make_timeline()
        self.vignette = self._make_vignette()
        self.gradient = self._make_gradient()
        self.glow_cyan = self._make_glow((52, 229, 255), 240)
        self.glow_red = self._make_glow((255, 48, 65), 260)
        self.opening = self._make_opening()
        self.end_overlay = self._make_end_overlay()
        self.chapter_overlays = [self._make_chapter(s, i) for i, s in enumerate(SCENES)]
        for cap in self.captions:
            cap["overlay"] = self._make_caption(cap["text"])

    def _make_timeline(self) -> None:
        cursor = 0.0
        for idx, original in enumerate(SCENES):
            scene = dict(original)
            scene["index"] = idx
            scene["start"] = cursor
            scene["audio_duration"] = audio_duration(AUDIO_DIR / scene["audio"])
            scene["duration"] = scene["lead"] + scene["audio_duration"] + scene["tail"]
            scene["end"] = scene["start"] + scene["duration"]
            self.timeline.append(scene)
            weights = [max(8, len(c)) for c in scene["captions"]]
            usable = max(1.0, scene["audio_duration"] - 0.35)
            cap_t = scene["start"] + scene["lead"] + 0.15
            for text, weight in zip(scene["captions"], weights):
                dur = usable * weight / sum(weights)
                self.captions.append(
                    {
                        "text": text,
                        "start": cap_t,
                        "end": cap_t + dur,
                        "scene": idx,
                    }
                )
                cap_t += dur
            cursor = scene["end"]
        self.total = cursor + END_CARD_SECONDS

    @staticmethod
    def _make_vignette() -> Image.Image:
        yy, xx = np.mgrid[0:H, 0:W]
        nx = (xx - W / 2) / (W / 2)
        ny = (yy - H / 2) / (H / 2)
        r = np.sqrt(nx * nx + ny * ny)
        alpha = np.clip((r - 0.43) / 0.72, 0, 1) ** 1.8 * 116
        arr = np.zeros((H, W, 4), dtype=np.uint8)
        arr[:, :, 3] = alpha.astype(np.uint8)
        return Image.fromarray(arr, "RGBA")

    @staticmethod
    def _make_gradient() -> Image.Image:
        arr = np.zeros((H, W, 4), dtype=np.uint8)
        for y in range(H):
            top = clamp(1.0 - y / 165.0) * 116
            bottom = clamp((y - (H - 260)) / 260.0) * 170
            arr[y, :, 3] = int(max(top, bottom))
        return Image.fromarray(arr, "RGBA")

    @staticmethod
    def _make_glow(color: tuple[int, int, int], size: int) -> Image.Image:
        yy, xx = np.mgrid[0:size, 0:size]
        r = np.sqrt((xx - size / 2) ** 2 + (yy - size / 2) ** 2) / (size / 2)
        alpha = np.clip(1 - r, 0, 1) ** 2.3 * 145
        arr = np.zeros((size, size, 4), dtype=np.uint8)
        arr[:, :, :3] = color
        arr[:, :, 3] = alpha.astype(np.uint8)
        return Image.fromarray(arr, "RGBA")

    @staticmethod
    def _opacity(im: Image.Image, amount: float) -> Image.Image:
        amount = clamp(amount)
        if amount >= 0.999:
            return im
        out = im.copy()
        out.putalpha(out.getchannel("A").point(lambda p: int(p * amount)))
        return out

    def _wrap(self, text: str, fnt: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
        lines: list[str] = []
        current = ""
        for word in text.split():
            candidate = f"{current} {word}".strip()
            if current and fnt.getlength(ur(candidate)) > max_width:
                lines.append(current)
                current = word
            else:
                current = candidate
        if current:
            lines.append(current)
        return lines

    def _make_caption(self, text: str) -> Image.Image:
        lines = self._wrap(text, self.f_sub, 1040)
        line_h = 54
        box_h = 42 + line_h * len(lines)
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        top = H - 38 - box_h
        d.rounded_rectangle(
            (82, top, W - 82, H - 38),
            radius=16,
            fill=(4, 10, 17, 196),
            outline=(112, 219, 227, 45),
            width=1,
        )
        d.rounded_rectangle((W - 91, top + 15, W - 86, H - 53), radius=2, fill=(70, 224, 229, 205))
        for i, line in enumerate(lines):
            d.text(
                (W / 2 - 4, top + 18 + i * line_h),
                ur(line),
                font=self.f_sub,
                fill=(247, 248, 243, 255),
                anchor="ma",
                stroke_width=1,
                stroke_fill=(0, 0, 0, 190),
            )
        return im

    def _make_opening(self) -> Image.Image:
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((443, 132, 837, 174), radius=21, fill=(4, 17, 26, 180), outline=(83, 222, 229, 105))
        d.text((W / 2, 141), ur(DISCLAIMER), font=self.f_small_ur, fill=(166, 237, 236, 255), anchor="ma")
        d.text((W / 2, 232), ur(TITLE), font=self.f_title, fill=(249, 247, 231, 255), anchor="ma", stroke_width=2, stroke_fill=(0, 7, 12, 220))
        d.line((435, 359, 845, 359), fill=(76, 218, 225, 180), width=2)
        d.ellipse((632, 351, 648, 367), fill=(100, 233, 235, 240))
        d.text((W / 2, 386), ENGLISH_TITLE, font=self.f_latin_title, fill=(198, 217, 219, 240), anchor="ma")
        d.text((W / 2, 430), ur(VALLEY), font=self.f_hud, fill=(183, 203, 204, 235), anchor="ma")
        return im

    def _make_chapter(self, scene: dict, idx: int) -> Image.Image:
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((45, 91, 526, 159), radius=10, fill=(4, 12, 19, 164))
        d.rectangle((45, 91, 50, 159), fill=(60, 221, 226, 220))
        d.text((69, 99), ur(scene["chapter"]), font=self.f_chapter, fill=(241, 242, 229, 250), anchor="la")
        d.text((70, 151), f"CHAPTER {idx + 1:02d}  /  MIZANORA ORIGINAL", font=self.f_latin_small, fill=(121, 192, 197, 220), anchor="ls")
        return im

    def _make_end_overlay(self) -> Image.Image:
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.rectangle((0, 0, W, H), fill=(2, 8, 13, 128))
        d.text((W / 2, 231), ur(END_QUOTE), font=self.f_end, fill=(247, 243, 224, 255), anchor="ma", stroke_width=1, stroke_fill=(0, 0, 0, 200))
        d.line((495, 351, 785, 351), fill=(82, 219, 222, 175), width=2)
        d.text((W / 2, 383), ur(DISCLAIMER), font=self.f_hud, fill=(165, 224, 224, 245), anchor="ma")
        d.text((W / 2, 438), ur(CREDIT), font=self.f_small_ur, fill=(193, 204, 201, 225), anchor="ma")
        d.text((W / 2, 506), ENGLISH_TITLE, font=self.f_latin_small, fill=(131, 157, 159, 210), anchor="ma")
        return im

    def base(self, idx: int, local_t: float) -> Image.Image:
        scene = self.timeline[idx]
        duration = scene["duration"]
        p = smooth(local_t / max(duration, 0.01))
        if idx % 2 == 0:
            zoom = 1.035 + 0.075 * p
        else:
            zoom = 1.11 - 0.07 * p
        src = self.images[idx]
        scale = max(W / src.width, H / src.height) * zoom
        nw, nh = math.ceil(src.width * scale), math.ceil(src.height * scale)
        im = src.resize((nw, nh), RESAMPLE)
        max_x, max_y = max(0, nw - W), max(0, nh - H)
        if idx % 3 == 0:
            fx, fy = 0.25 + 0.48 * p, 0.48 - 0.14 * p
        elif idx % 3 == 1:
            fx, fy = 0.70 - 0.38 * p, 0.35 + 0.18 * p
        else:
            fx, fy = 0.30 + 0.35 * p, 0.58 - 0.20 * p
        x = int(max_x * clamp(fx))
        y = int(max_y * clamp(fy))
        if idx == 7:
            x = int(clamp(x + 2.4 * math.sin(local_t * 29), 0, max_x))
            y = int(clamp(y + 1.8 * math.sin(local_t * 37), 0, max_y))
        frame = im.crop((x, y, x + W, y + H)).convert("RGBA")
        frame = Image.alpha_composite(frame, self.vignette)
        self._add_atmosphere(frame, idx, local_t)
        frame = Image.alpha_composite(frame, self.gradient)
        return frame

    def _add_atmosphere(self, frame: Image.Image, idx: int, t: float) -> None:
        # Soft glows reinforce the story's recurring three-light motif.
        glow_specs = {
            0: [(695, 422, 0), (850, 453, 1.8), (960, 393, 3.5)],
            2: [(840, 395, 0), (955, 408, 1.8), (1035, 380, 3.5)],
            3: [(708, 535, 0), (975, 490, 2.0)],
            6: [(910, 318, 0)],
            7: [(835, 535, 0), (975, 544, 1.8), (1060, 520, 3.4)],
            8: [(682, 505, 0)],
        }
        for x, y, phase in glow_specs.get(idx, []):
            pulse = 0.42 + 0.28 * (0.5 + 0.5 * math.sin(t * 1.8 + phase))
            sprite = self.glow_red if idx in (6, 7) else self.glow_cyan
            sprite = self._opacity(sprite, pulse)
            frame.alpha_composite(sprite, (x - sprite.width // 2, y - sprite.height // 2))
        overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(overlay)
        if idx == 7:  # rain
            rng = np.random.default_rng(881)
            for i in range(105):
                x0 = float(rng.uniform(-100, W + 100))
                y0 = float(rng.uniform(0, H))
                speed = float(rng.uniform(410, 760))
                x = (x0 + t * 88) % (W + 180) - 90
                y = (y0 + t * speed) % (H + 90) - 45
                length = float(rng.uniform(12, 34))
                d.line((x, y, x - length * 0.34, y + length), fill=(173, 218, 230, int(rng.uniform(45, 115))), width=1)
        else:
            count = 34 if idx in (3, 4, 5) else 20
            rng = np.random.default_rng(1200 + idx)
            for i in range(count):
                x0 = float(rng.uniform(15, W - 15))
                y0 = float(rng.uniform(0, H))
                speed = float(rng.uniform(5, 20))
                x = x0 + math.sin(t * 0.35 + i) * 12
                y = (y0 - t * speed) % (H + 50) - 25 if idx in (3, 4, 5) else (y0 + t * speed * 0.28) % H
                r = float(rng.uniform(0.8, 2.6))
                alpha = int(rng.uniform(30, 100))
                color = (114, 224, 235, alpha) if idx != 1 else (255, 212, 143, alpha)
                d.ellipse((x - r, y - r, x + r, y + r), outline=color, width=1)
        if idx == 8:  # last circular ripple
            for k in range(3):
                phase = (t * 0.23 + k / 3) % 1.0
                rx = 20 + phase * 130
                ry = rx * 0.24
                d.ellipse((682 - rx, 505 - ry, 682 + rx, 505 + ry), outline=(91, 226, 232, int(100 * (1 - phase))), width=2)
        frame.alpha_composite(overlay)
        if idx == 7:
            flash = 0.0
            for ft in (0.32, 3.4, 8.1, 13.8):
                delta = abs(t - ft)
                if delta < 0.12:
                    flash = max(flash, (1 - delta / 0.12) * 0.34)
            if flash:
                frame.alpha_composite(Image.new("RGBA", (W, H), (214, 235, 255, int(255 * flash))))

    def _hud(self, idx: int, global_t: float) -> Image.Image:
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        c = (118, 217, 220, 150)
        d.line((28, 45, 28, 27, 48, 27), fill=c, width=2)
        d.line((W - 28, 45, W - 28, 27, W - 48, 27), fill=c, width=2)
        d.line((28, H - 45, 28, H - 27, 48, H - 27), fill=c, width=2)
        d.line((W - 28, H - 45, W - 28, H - 27, W - 48, H - 27), fill=c, width=2)
        d.text((54, 31), ur("وادیٔ سَرم / خصوصی تحقیق"), font=self.f_hud, fill=(211, 229, 225, 225), anchor="la")
        d.text((W - 52, 35), self.timeline[idx]["file"], font=self.f_latin_small, fill=(158, 199, 201, 215), anchor="ra")
        if int(global_t * 2) % 2 == 0:
            d.ellipse((W - 67, 62, W - 59, 70), fill=(91, 225, 222, 205))
        d.text((W - 78, 59), "FICTIONAL FIELD RECORD", font=self.f_latin_small, fill=(118, 161, 164, 190), anchor="ra")
        return im

    def render_scene(self, idx: int, local_t: float) -> Image.Image:
        scene = self.timeline[idx]
        global_t = scene["start"] + local_t
        frame = self.base(idx, local_t)
        if not (idx == 0 and local_t < 4.7):
            frame = Image.alpha_composite(frame, self._hud(idx, global_t))
        if idx == 0:
            alpha = fade_window(local_t, 0.55, 4.55, 0.8)
            if alpha:
                shade = Image.new("RGBA", (W, H), (1, 7, 12, int(86 * alpha)))
                frame = Image.alpha_composite(frame, shade)
                frame = Image.alpha_composite(frame, self._opacity(self.opening, alpha))
        elif local_t < 5.0:
            alpha = fade_window(local_t, 0.25, 4.9, 0.6)
            frame = Image.alpha_composite(frame, self._opacity(self.chapter_overlays[idx], alpha))
        for cap in self.captions:
            if cap["scene"] != idx:
                continue
            alpha = fade_window(global_t, cap["start"], cap["end"], 0.20)
            if alpha:
                frame = Image.alpha_composite(frame, self._opacity(cap["overlay"], alpha))
                break
        # Letterbox and gentle dip-to-black between chapters.
        d = ImageDraw.Draw(frame)
        d.rectangle((0, 0, W, 15), fill=(0, 0, 0, 255))
        d.rectangle((0, H - 15, W, H), fill=(0, 0, 0, 255))
        fade = 0.0
        if idx == 0 and local_t < 1.0:
            fade = 1.0 - smooth(local_t)
        if local_t > scene["duration"] - 0.58:
            fade = max(fade, smooth((local_t - (scene["duration"] - 0.58)) / 0.58) * 0.88)
        if idx > 0 and local_t < 0.52:
            fade = max(fade, (1.0 - smooth(local_t / 0.52)) * 0.88)
        if fade:
            frame = Image.alpha_composite(frame, Image.new("RGBA", (W, H), (0, 0, 0, int(255 * fade))))
        return frame.convert("RGB")

    def render_end(self, local_t: float) -> Image.Image:
        src = self.images[8]
        scale = max(W / src.width, H / src.height) * 1.045
        im = src.resize((math.ceil(src.width * scale), math.ceil(src.height * scale)), RESAMPLE)
        x = (im.width - W) // 2
        y = (im.height - H) // 2
        frame = im.crop((x, y, x + W, y + H)).convert("RGBA").filter(ImageFilter.GaussianBlur(1.1))
        alpha = fade_window(local_t, 0.0, END_CARD_SECONDS - 0.15, 0.85)
        frame = Image.alpha_composite(frame, self._opacity(self.end_overlay, alpha))
        if local_t > END_CARD_SECONDS - 1.2:
            black = smooth((local_t - (END_CARD_SECONDS - 1.2)) / 1.2)
            frame = Image.alpha_composite(frame, Image.new("RGBA", (W, H), (0, 0, 0, int(255 * black))))
        return frame.convert("RGB")

    def frame_at(self, t: float) -> Image.Image:
        for scene in self.timeline:
            if t < scene["end"]:
                return self.render_scene(scene["index"], t - scene["start"])
        return self.render_end(t - (self.total - END_CARD_SECONDS))

    def write_srt(self) -> None:
        blocks = []
        for i, cap in enumerate(self.captions, 1):
            blocks.append(f"{i}\n{srt_time(cap['start'])} --> {srt_time(cap['end'])}\n{cap['text']}\n")
        (OUTPUT / "urdu-subtitles.srt").write_text("\n".join(blocks), encoding="utf-8")

    def make_thumbnail(self) -> None:
        frame = self.base(0, 7.0)
        shade = Image.new("RGBA", (W, H), (0, 5, 10, 72))
        frame = Image.alpha_composite(frame, shade)
        frame = Image.alpha_composite(frame, self.opening)
        d = ImageDraw.Draw(frame)
        d.rounded_rectangle((49, 626, 333, 674), radius=20, fill=(5, 19, 26, 210), outline=(91, 221, 224, 110))
        d.text((191, 635), ur("اردو میں • مکمل اینیمی"), font=self.f_hud, fill=(213, 240, 235, 255), anchor="ma")
        frame.convert("RGB").save(OUTPUT / "thumbnail.jpg", quality=94, subsampling=0)

    def preview(self) -> None:
        times = [2.8]
        times += [s["start"] + s["lead"] + s["audio_duration"] * 0.43 for s in self.timeline]
        times.append(self.total - 3.8)
        thumbs = []
        for i, t in enumerate(times):
            print(f"Preview {i + 1}/{len(times)} at {t:.2f}s", flush=True)
            im = self.frame_at(t)
            im.save(WORK / f"preview_{i:02d}.jpg", quality=92)
            thumb = im.copy()
            thumb.thumbnail((384, 216))
            thumbs.append(thumb)
        sheet = Image.new("RGB", (384 * 3, 236 * 4), (5, 10, 16))
        d = ImageDraw.Draw(sheet)
        for i, im in enumerate(thumbs):
            x, y = (i % 3) * 384, (i // 3) * 236
            sheet.paste(im, (x, y))
            d.text((x + 9, y + 218), f"PREVIEW {i:02d}", font=self.f_latin_small, fill=(170, 210, 211))
        sheet.save(WORK / "preview-contact.jpg", quality=92)
        self.make_thumbnail()
        self.write_srt()
        print(f"Total runtime: {self.total:.2f}s")

    def render_video(self) -> Path:
        visual = WORK / "visual.mp4"
        frames = math.ceil(self.total * FPS)
        cmd = [
            FFMPEG,
            "-y",
            "-hide_banner",
            "-loglevel",
            "warning",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "-s",
            f"{W}x{H}",
            "-r",
            str(FPS),
            "-i",
            "-",
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "19",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(visual),
        ]
        started = time.time()
        with open(WORK / "ffmpeg-video.log", "wb") as log:
            proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=log, stderr=log)
            assert proc.stdin is not None
            for n in range(frames):
                t = n / FPS
                proc.stdin.write(self.frame_at(t).tobytes())
                if n % (FPS * 10) == 0:
                    elapsed = time.time() - started
                    rate = (n + 1) / max(elapsed, 0.01)
                    remaining = (frames - n - 1) / max(rate, 0.01)
                    print(f"Render {n / frames:6.1%} | {t:6.1f}/{self.total:.1f}s | ETA {remaining / 60:4.1f} min", flush=True)
            proc.stdin.close()
            code = proc.wait()
        if code:
            raise RuntimeError(f"ffmpeg video encoder failed; see {WORK / 'ffmpeg-video.log'}")
        print(f"Visual complete: {visual}", flush=True)
        return visual

    def synth_music(self) -> Path:
        """Create an original ambient score and restrained story sound design."""
        sr = 32000
        n = math.ceil(self.total * sr)
        music = np.zeros((n, 2), dtype=np.float32)
        rng = np.random.default_rng(271911)
        chords = [
            (73.416, 110.000, 174.614),
            (65.406, 98.000, 146.832),
            (73.416, 110.000, 164.814),
            (58.270, 87.307, 138.591),
            (65.406, 98.000, 155.563),
            (73.416, 110.000, 174.614),
            (61.735, 92.499, 146.832),
            (58.270, 87.307, 130.813),
            (73.416, 110.000, 174.614),
        ]

        def add(signal: np.ndarray, start: float, pan: float = 0.0, gain: float = 1.0) -> None:
            first = max(0, int(start * sr))
            if first >= n:
                return
            length = min(len(signal), n - first)
            left = math.sqrt((1 - pan) / 2)
            right = math.sqrt((1 + pan) / 2)
            music[first:first + length, 0] += signal[:length] * left * gain
            music[first:first + length, 1] += signal[:length] * right * gain

        for idx, scene in enumerate(self.timeline):
            start = scene["start"]
            duration = scene["duration"] + 0.5
            count = int(duration * sr)
            t = np.arange(count, dtype=np.float32) / sr
            env = np.minimum(np.clip(t / 2.2, 0, 1), np.clip((duration - t) / 2.2, 0, 1))
            env = env * env * (3 - 2 * env)
            chord = chords[idx]
            pad = np.zeros(count, dtype=np.float32)
            for j, freq in enumerate(chord):
                wobble = 0.12 * np.sin(2 * np.pi * (0.035 + j * 0.009) * t)
                pad += (0.42 / (j + 1)) * np.sin(2 * np.pi * freq * t + wobble + j * 0.7)
                pad += 0.055 * np.sin(2 * np.pi * freq * 2.002 * t + j)
            pad *= env * (0.72 + 0.14 * np.sin(2 * np.pi * 0.055 * t + idx))
            add(pad, start, pan=-0.16 + 0.04 * idx, gain=0.19)
            add(np.roll(pad, 317), start, pan=0.25 - 0.03 * idx, gain=0.13)
            # Slow, band-limited mountain air.
            control_count = max(4, int(duration * 80))
            control = rng.normal(0, 1, control_count).astype(np.float32)
            air = np.interp(np.arange(count), np.linspace(0, count - 1, control_count), control).astype(np.float32)
            air *= env * 0.008
            add(air, start, pan=0.4 * math.sin(idx), gain=1.0)

        # Sparse glass-like notes, deliberately leaving space for the narrator.
        scale = [293.665, 349.228, 392.000, 440.000, 523.251, 587.330]
        event = 2.0
        k = 0
        while event < self.total - 5:
            dur = 4.2
            t = np.arange(int(dur * sr), dtype=np.float32) / sr
            freq = scale[(k * 2 + k // 3) % len(scale)]
            bell = (np.sin(2 * np.pi * freq * t) + 0.28 * np.sin(2 * np.pi * freq * 2.01 * t))
            bell *= (1 - np.exp(-t * 18)) * np.exp(-t * 1.15) * 0.055
            add(bell, event, pan=0.55 * math.sin(k * 1.9))
            event += 6.8 + (k % 3) * 1.35
            k += 1

        # Underwater droplets and sonar-like calls.
        for idx in (3, 4, 5):
            scene = self.timeline[idx]
            event = scene["start"] + 2.3
            while event < scene["end"] - 1:
                t = np.arange(int(1.8 * sr), dtype=np.float32) / sr
                drop = np.sin(2 * np.pi * (660 * t - 110 * t * t)) * np.exp(-t * 4.8) * 0.038
                add(drop, event, pan=float(rng.uniform(-0.75, 0.75)))
                event += 3.6

        # A restrained pulse as the warning turns red, then the storm arrives.
        for idx in (6, 7):
            scene = self.timeline[idx]
            event = scene["start"] + 1.0
            while event < scene["end"]:
                t = np.arange(int(1.1 * sr), dtype=np.float32) / sr
                thump = np.sin(2 * np.pi * (57 * t - 6 * t * t)) * np.exp(-t * 5.2) * 0.095
                add(thump, event, pan=0.0)
                event += 1.55 if idx == 7 else 2.1

        # Thunder is synthesized noise, not a sampled recording.
        storm = self.timeline[7]
        for offset, gain in ((0.28, 0.16), (3.35, 0.10), (8.05, 0.12)):
            dur = 4.0
            t = np.arange(int(dur * sr), dtype=np.float32) / sr
            noise = rng.normal(0, 1, len(t)).astype(np.float32)
            kernel = np.ones(48, dtype=np.float32) / 48
            low = np.convolve(noise, kernel, mode="same")
            thunder = low * np.exp(-t * 0.9) * (1 - np.exp(-t * 16)) * gain
            add(thunder, storm["start"] + offset, pan=-0.15)

        peak = float(np.max(np.abs(music)))
        if peak > 0:
            music *= min(1.0, 0.78 / peak)
        # Global fades prevent clicks and give the ending room to breathe.
        fade_in = min(n, int(2.0 * sr))
        fade_out = min(n, int(3.5 * sr))
        music[:fade_in] *= np.linspace(0, 1, fade_in, dtype=np.float32)[:, None]
        music[-fade_out:] *= np.linspace(1, 0, fade_out, dtype=np.float32)[:, None]
        path = WORK / "original-score.wav"
        with wave.open(str(path), "wb") as wav:
            wav.setnchannels(2)
            wav.setsampwidth(2)
            wav.setframerate(sr)
            wav.writeframes((np.clip(music, -1, 1) * 32767).astype("<i2").tobytes())
        print(f"Original score complete: {path}", flush=True)
        return path

    def mix(self, visual: Path, score: Path) -> Path:
        output = OUTPUT / "jheel-ke-neeche-urdu-anime.mp4"
        cmd = [FFMPEG, "-y", "-hide_banner", "-loglevel", "warning", "-i", str(visual), "-i", str(score)]
        filters = []
        labels = []
        for i, scene in enumerate(self.timeline):
            delay = round((scene["start"] + scene["lead"]) * 1000)
            cmd += ["-i", str(AUDIO_DIR / scene["audio"])]
            label = f"n{i}"
            filters.append(f"[{i + 2}:a]adelay={delay}:all=1,volume=1.18[{label}]")
            labels.append(f"[{label}]")
        filters.append("".join(labels) + f"amix=inputs={len(labels)}:duration=longest:dropout_transition=0:normalize=0[narr]")
        filters.append("[1:a]volume=0.42[music]")
        filters.append(
            f"[music][narr]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0,"
            f"alimiter=limit=0.95,atrim=duration={self.total:.3f},"
            f"afade=t=out:st={self.total - 2.8:.3f}:d=2.8[aout]"
        )
        cmd += [
            "-filter_complex",
            ";".join(filters),
            "-map",
            "0:v:0",
            "-map",
            "[aout]",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-ar",
            "48000",
            "-t",
            f"{self.total:.3f}",
            "-movflags",
            "+faststart",
            "-metadata",
            f"title={TITLE}",
            "-metadata",
            "comment=Original fictional Urdu animated documentary",
            str(output),
        ]
        with open(WORK / "ffmpeg-audio.log", "wb") as log:
            subprocess.run(cmd, stdout=log, stderr=log, check=True)
        print(f"Final film: {output}", flush=True)
        return output

    def build(self) -> None:
        self.write_srt()
        self.make_thumbnail()
        visual = self.render_video()
        score = self.synth_music()
        output = self.mix(visual, score)
        print(f"DONE: {output} ({output.stat().st_size / 1024 / 1024:.1f} MiB)", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", action="store_true")
    parser.add_argument("--build", action="store_true")
    args = parser.parse_args()
    if not args.preview and not args.build:
        parser.error("Choose --preview or --build")
    film = Film()
    if args.preview:
        film.preview()
    if args.build:
        film.build()


if __name__ == "__main__":
    main()
