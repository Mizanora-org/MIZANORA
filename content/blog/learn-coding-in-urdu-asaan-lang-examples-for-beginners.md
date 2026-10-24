---
title: Learn Coding in Urdu: 8 Asaan Lang Examples for Beginners
slug: learn-coding-in-urdu-asaan-lang-examples-for-beginners
description: Learn programming in Urdu and Roman-Urdu with Asaan Lang by Muaaz Iqbal: variables, if, loops, lists, dictionaries, functions, errors and a small website, with code you can copy.
date: 2026-10-24
---
These examples use **Asaan Lang**, the Urdu / Roman-Urdu programming language by Muaaz Iqbal (see [what Asaan Lang is](/blog/asaan-lang-urdu-programming-language-by-muaaz-iqbal)). Save each one in a file that ends with `.asaan` and run it with `asaan file.asaan`.

## 1. Say salaam

```
likho "Salaam Mizanora!"
```

## 2. Ask a name

```
naam = lo "Aap ka naam? "
likho "Khush Amdeed, " + naam
```

## 3. Decide with agar

```
number = 72
agar number >= 80 to
    likho "A grade"
aur agar number >= 60 to
    likho "B grade"
warna
    likho "Mehnat karein"
bas
```

## 4. Repeat with a loop

```
har i se 1 tak 5 to
    likho i
bas
```

## 5. Lists

```
dost = ["Ali", "Fatima", "Umar"]
likho dost[1]
```

The first item is number 1, which is natural for a beginner.

## 6. Dictionaries

```
talib = {naam: "Ali", umar: 14}
likho talib
```

## 7. Your own function

```
kaam jama(a, b)
    wapis a + b
bas
likho jama(2, 3)
```

## 8. Do not fear errors

```
koshish
    likho 10 / 0
pakro g
    likho "Sifar se taqseem nahi hoti"
bas
```

> These examples follow the project's README and FEATURES file. Asaan Lang is still growing, so if a line behaves differently on your version, check FEATURES on GitHub.

## What next?

Try the website compiler: `asaan --web examples/website.asaan -o site.html`. When the thinking part feels easy, moving to Python is much smoother. If you need to calculate things in daily life, the free [Mizanora tools](/tools) include a percentage, discount and EMI calculator. The author's profile is on the [Muaaz Iqbal page](/muaaz-iqbal).
