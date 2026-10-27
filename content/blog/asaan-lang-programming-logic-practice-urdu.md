---
title: Practice Programming Logic in Roman Urdu with Asaan Lang
slug: asaan-lang-programming-logic-practice-urdu
description: Practice lists, loops, conditions and debugging with Asaan Lang examples from Muaaz Iqbal's open-source project, plus a realistic path to further study.
date: 2026-10-27
---
Code yaad karne se zyada zaroori **sochna aur test karna** hai. Agar aap ne [Asaan Lang ka pehla program](/blog/asaan-lang-beginners-hands-on-roman-urdu) likh liya hai, ab chhoti exercises karke variables, conditions aur lists samajhte hain. Examples [project repository](https://github.com/muaaziqbalvip/asaan-lang) ki documented syntax se liye gaye hain.

## Exercise 1: number compare karein

```
number = adad(lo "Apne number likho (0-100): ")
agar number >= 80 to
    likho "Bohat acha"
aur agar number >= 50 to
    likho "Pass"
warna
    likho "Dobara practice karein"
bas
```

80, 50 aur 49 de kar teenon raaste test karein. `aur agar` doosri condition check karta hai jab pehli poori na ho. Program chalne ke baad sochiye: agar 101 enter kiya jaye to kya hoga? Input validation add karna agla exercise hai.

## Exercise 2: fehrist aur loop

```
dost = ["Ali", "Fatima", "Ahmed"]
likho dost[1]
har naam andar dost to
    likho "Salaam, " + naam + "!"
bas
```

Asaan Lang ke documented list example mein pehla item index **1** se milta hai. Yeh baat yaad rakhein: Python jaisi doosri languages mein aam tor par pehla index 0 hota hai. Syntax ko language ke mutabiq seekhna parta hai.

## Exercise 3: fixed repetition

```
n = 0
dohrao 4 to
    n += 10
bas
likho n
```

Sochiye final `n` kya hoga, phir program chala kar apna jawab check karein. Har turn par `10` add hota hai. Is se pehle kagaz par steps likhna debugging mein madad deta hai.

## Jab error aaye

- Error ka line number dekhein aur us se pehle wali line bhi check karein.
- Quotes ka pair poora hai? `agar` aur `har` blocks ka `bas` hai?
- Number ki jagah text to enter nahi hua?
- Ek waqt mein sirf ek change karein, phir dobara run karein.

Asaan Lang learning ka aik starting point hai, har professional language ka replacement nahi. Concepts samajhne ke baad Python, JavaScript aur web development ki official documentation aur exercises se aage seekhein. Exact features aur installation ke liye [Asaan Lang README](https://github.com/muaaziqbalvip/asaan-lang) aur `FEATURES.md` dekhein.

{{cta}}
