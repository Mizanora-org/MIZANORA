---
title: Linux Commands for Beginners: Cheat Sheet (Urdu + English)
slug: linux-commands-for-beginners-cheat-sheet-urdu
description: The most useful Linux commands for beginners with simple explanations: files, search, permissions (chmod), processes, network, apt and git. Free searchable cheat sheet.
date: 2026-10-23
---
Linux seekhna hai to terminal se dosti zaroori hai. Ye guide beginners ke liye sab se zaroori **Linux commands** batati hai. Search karne ke liye hamari [Linux Commands Cheat Sheet](/tools/linux-commands-cheat-sheet) kholein: 120 se zyada commands, ek tap mein copy.

## 1. Basics

- `pwd` aap kis folder mein hain.
- `ls -la` sab files ki list.
- `cd folder` folder mein jao, `cd ..` ek step peeche.
- `man ls` kisi bhi command ka manual.

## 2. Files aur folders

- `mkdir`, `touch`, `cp`, `mv`, `rm`.
- `cat`, `less`, `head`, `tail -f` file parhne ke liye.
- **Ehtiyat:** `rm -rf` bina poochhe delete karta hai. Path do baar check karein.

## 3. Search

- `grep -rn "word" .` sab files mein lafz dhoondo.
- `find . -name "*.js"` naam se file dhoondo.

## 4. Permissions

Har file ke teen group hote hain: owner, group, others. `chmod 755` aur `chmod 644` sab se aam hain. Number khud banane ke liye [Chmod Calculator](/tools/chmod-calculator) istemal karein. 777 se bachein.

## 5. System aur processes

`top`, `ps aux`, `kill`, `df -h`, `free -h`, `systemctl status nginx`. Scheduled kaam ke liye cron: [Cron Expression Generator](/tools/cron-expression-generator).

## 6. Packages

Ubuntu/Debian par `sudo apt update` phir `sudo apt install package`. Fedora par `dnf`, Arch par `pacman`.

## 7. Network

`ping`, `ip a`, `ss -tulpn`, `curl -I`, `ssh user@host`. Sirf apne servers par port scan karein.

{{cta}}

## Developer tools

[JSON Formatter](/tools/json-formatter-validator), [Base64](/tools/base64-encoder-decoder), [Regex Tester](/tools/regex-tester), [SHA-256 Hash](/tools/sha256-hash-generator), [Password Generator](/tools/password-generator), [UUID](/tools/uuid-generator), [Timestamp](/tools/timestamp-converter).

Practice ka tareeqa: roz 5 command seekhein, virtual machine ya WSL mein chala kar dekhein, aur kabhi bhi koi command bina samjhe sudo ke saath na chalayen.
