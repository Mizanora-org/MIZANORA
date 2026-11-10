# جھیل کے نیچے کا آخری شہر

**ایک افسانوی دستاویزی اینیمی — مکمل اردو narration کے ساتھ**

یہ ایک اصل، افسانوی پراسرار کہانی ہے۔ نوجوان محقق آیان وادیٔ سَرم کی جھیل میں ستائیس سال بعد جگمگانے والی نیلی روشنیوں کی تحقیق کرتا ہے۔ قدیم نقشے، زیرِ آب نشانات اور ایک خاموش شہر سے وہ ایسا انتباہ دریافت کرتا ہے جو ماضی نے مستقبل کے لیے چھوڑا تھا۔

> اس ویڈیو میں واقعات، وادیٔ سَرم، جھیلِ مِہر، کردار اور تاریخی ریکارڈ سب افسانوی ہیں۔ اسے حقیقی دستاویزی رپورٹ نہ سمجھا جائے۔

## تیار شدہ فائلیں

- `output/jheel-ke-neeche-urdu-anime.mp4` — مکمل ویڈیو، 1280×720، 24 FPS، H.264/AAC
- `output/thumbnail.jpg` — اردو thumbnail
- `output/urdu-subtitles.srt` — الگ اردو subtitles؛ ویڈیو میں burned-in subtitles بھی موجود ہیں

## نمایاں خصوصیات

- نو اصل anime-style سینماٹک مناظر
- منتخب کردہ مرد اردو narrator
- متحرک camera push/pan، زیرِ آب ذرات، بارش، روشنی کی لہریں اور transitions
- اردو chapter cards اور synced burned-in subtitles
- Python سے تخلیق شدہ اصل ambient score، underwater droplets، warning pulses اور thunder
- opening اور ending پر واضح fictional-documentary disclosure

## دوبارہ بنانے کا طریقہ

Repository root سے:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r mystery-anime/scripts/requirements.txt
.venv/bin/python mystery-anime/scripts/build.py --preview
.venv/bin/python mystery-anime/scripts/build.py --build
```

`imageio-ffmpeg` اپنا bundled FFmpeg استعمال کرتا ہے، اس لیے الگ system FFmpeg درکار نہیں۔ Preview اور intermediate files `mystery-anime/work/` میں بنتی ہیں۔

## Source layout

- `scripts/story.py` — مکمل اردو narration اور captions
- `scripts/build.py` — animation، typography، soundtrack، audio mix اور final export
- `assets/scenes/` — نو منظر کی 1672×941 تصاویر
- `assets/fonts/` — Noto Naskh Arabic اور Noto Nastaliq Urdu
- `audio/narration/` — ہر منظر کی الگ اردو narration

## مناظر

1. نیلی روشنیاں اور جھیل کا تعارف
2. 1911 کے افسانوی survey map میں نشان
3. آخری چاندنی رات کا سفر
4. زیرِ آب پتھر کی چوکی
5. فضا میں محفوظ خاموش شہر
6. پانی کے دباؤ سے چلنے والا فلکیاتی آلہ
7. دیواروں پر سیلاب کا انتباہ
8. نکاسی نالی اور وادی کو بلند مقام پر منتقلی
9. طوفان کے بعد صبح اور کھلا اختتام
