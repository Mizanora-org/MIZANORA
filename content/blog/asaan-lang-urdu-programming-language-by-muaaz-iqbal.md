---
title: Asaan Lang: Pakistan's Urdu Programming Language by Muaaz Iqbal
slug: asaan-lang-urdu-programming-language-by-muaaz-iqbal
description: Asaan Lang (آسان لینگ) is an Urdu and Roman-Urdu programming language made by Muaaz Iqbal of Mizanora. What it is, how to install it, its keywords, the website compiler and why it helps beginners.
date: 2026-10-24
---
**Asaan Lang** (آسان لینگ, "easy language") is a programming language that you write in **Urdu or Roman-Urdu**. It was made by **Muaaz Iqbal**, the founder of Mizanora, and it is free and open source under the MIT licence. The idea is simple: think in Urdu first, learn how code works (variables, decisions, loops), and move to Python or other languages afterwards.

## Why a language in Urdu?

Many students in Pakistan must learn English before they can even read their first line of code. Asaan Lang removes that wall. The keywords are words you already use every day, and the error messages come back in Roman-Urdu with the line number, so a beginner knows what went wrong and where.

- Code in **Roman-Urdu** (likho, agar, warna) or **Urdu script** (لکھو).
- Errors in Roman-Urdu, with the line number.
- Meant for beginners, schools and Urdu-medium students.
- A built-in **website compiler**: you describe a page in Asaan Lang and get an HTML file with meta tags, Open Graph and JSON-LD.
- Only Python 3.8+ is needed. There is no pip package to install.

## A first program

```
naam = lo "Aap ka naam? "
agar naam != "" to
    likho "Khush Amdeed, " + naam + "!"
warna
    likho "Mehman, salaam!"
bas
```

`lo` asks the user for input, `likho` prints, `agar ... to ... warna ... bas` is an if / else block. The same program works with Urdu script words, for example `لکھو "السلام علیکم دنیا!"`.

## The main keywords

- **likho**: print. **lo**: read input.
- **agar / aur agar / warna / bas**: if, else if, else, end.
- **har i se 1 tak 10 to**, **dohrao 5 to**, **jabtak**: loops.
- **kaam jama(a, b) wapis a + b bas**: a function.
- **koshish ... pakro ... bas**: try and catch.
- **lao "lib_hisab.asaan"**: import another file.
- **ittifaq(1, 6)**: a random number.
- **safha, unwan, para, card, button, footer**: build a web page.

The complete dictionary is in the FEATURES file of the project on GitHub.

## Install and run

1. Install Python 3.8 or newer (on Windows tick "Add python.exe to PATH").
2. Download the project from [github.com/muaaziqbalvip/asaan-lang](https://github.com/muaaziqbalvip/asaan-lang).
3. Run `install.sh` (Linux and macOS) or double-click `install.bat` (Windows). Open a new terminal.
4. Try `asaan -e "likho 1+2"`, then `asaan meri.asaan` for a file.
5. `asaan --studio` opens a local playground in your browser, and `asaan --web site.asaan -o site.html` turns a program into a website.

## Where it fits in the Mizanora family

Asaan Lang is one of several projects by Muaaz Iqbal: the [Mizanora](/) online market, order tracking, an Android panel, an agent website and an AI WhatsApp agent. You can read the full profile on the [Muaaz Iqbal page](/muaaz-iqbal) and find the language on its own site, [asaan-lang.vercel.app](https://asaan-lang.vercel.app).

> Asaan Lang is an educational language. It is made to teach thinking in code, not to replace Python in big projects.

## Credit

If you use Asaan Lang in a school, a video or research, the project asks you to credit: Iqbal, Muaaz. (2026). Asaan Lang: an Urdu / Roman-Urdu educational programming language. MIT License. For more free learning material see the [Mizanora tools](/tools) and the [blog](/blog).
