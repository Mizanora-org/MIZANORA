---
title: Asaan Lang for Beginners: Your First Urdu and Roman Urdu Programs
slug: asaan-lang-beginners-hands-on-roman-urdu
description: Start learning programming with Asaan Lang by Muaaz Iqbal: install or run with Python, print, input, conditions and loops using practical beginner examples.
date: 2026-10-27
---
Programming ka matlab computer ko step-by-step instructions dena hai. **Asaan Lang**, Muaaz Iqbal ka project, Urdu aur Roman Urdu keywords se in concepts ki practice karwata hai. Yeh [open-source repository](https://github.com/muaaziqbalvip/asaan-lang) par MIT licence ke saath available hai. Neeche ke examples repository ki documented syntax par mabni hain; project update hone par official README check karein.

## Shuru karne ke liye kya chahiye?

Project README Python 3.8 ya newer batata hai. GitHub se repository download ya clone karein aur us folder mein terminal kholein. Bina install kiye project ka example is tarah run hota hai:

```
python3 asaan.py examples/hello.asaan
```

Windows par aapke Python setup ke mutabiq `python` ya `py` command ki zaroorat ho sakti hai. Installation aur studio chalane ke updated steps [official README](https://github.com/muaaziqbalvip/asaan-lang#install-python-ki-tarah) mein dekhein. Local studio aapke apne computer par chalta hai; isay internet par public karna zaroori nahi.

## Pehla program: output

```
likho "Assalam-o-Alaikum, Duniya!"
```

`likho` screen par text dikhata hai. Quotes ke andar message likhein. Urdu script ka documented example bhi hai:

```
لکھو "السلام علیکم دنیا!"
```

## Input aur variable

```
naam = lo "Aap ka naam kya hai? "
likho "Khush Amdeed, " + naam + "!"
```

`lo` user se jawab leta hai; `naam` us jawab ko yaad rakhne wala variable hai. `+` yahan text ke hisson ko jorta hai. File ko `.asaan` extension se save karke `python3 asaan.py meri-file.asaan` se chala sakte hain.

## Faisla: agar aur warna

```
number = adad(lo "Apne number likho: ")
agar number >= 50 to
    likho "Pass"
warna
    likho "Mehnat jari rakhein"
bas
```

`adad` input ko number banata hai. Agar number 50 ya us se zyada ho to pehla message; warna doosra. `bas` block ko khatam karta hai.

## Loop: kaam dohrana

```
har i se 1 tak 5 to
    likho i
bas
```

Is mein `i` har turn par badalta hai. Code run karke output dekhein, phir `5` ko `10` karein. Error aaye to line number aur quotes check karein. Agla qadam [logic practice guide](/blog/asaan-lang-programming-logic-practice-urdu) hai; poori dictionary GitHub ke FEATURES file mein hai.

{{cta}}
