// Linux commands for the cheat sheet tool (v25). Row: group | command | what it does. Written by hand, short and safe.
const RAW = `Basics|pwd|Show the folder you are in
Basics|ls -la|List all files with size, owner and date
Basics|cd /path|Go to a folder (cd .. = up, cd ~ = home, cd - = back)
Basics|clear|Clear the terminal screen
Basics|man ls|Open the manual page of a command
Basics|history|Show the commands you typed before
Basics|whoami|Show your user name
Basics|uname -a|Show kernel and system information
Basics|date|Show the date and time
Basics|cal|Show a calendar
Basics|echo "hello"|Print text
Basics|alias ll='ls -la'|Make a short name for a command
Basics|which python3|Show where a program is installed
Basics|sudo command|Run a command as administrator
Basics|exit|Close the terminal session
Files|mkdir folder|Make a folder (mkdir -p a/b/c makes all)
Files|touch file.txt|Create an empty file or update its time
Files|cp a.txt b.txt|Copy a file (cp -r copies a folder)
Files|mv a.txt b.txt|Move or rename a file
Files|rm file.txt|Delete a file (rm -r folder deletes a folder: careful)
Files|rmdir folder|Delete an empty folder
Files|cat file.txt|Show the whole file
Files|less file.txt|Read a long file page by page (q to quit)
Files|head -n 20 file.txt|Show the first 20 lines
Files|tail -n 50 file.txt|Show the last 50 lines
Files|tail -f app.log|Follow a log file live
Files|find . -name "*.js"|Find files by name
Files|ln -s target link|Make a shortcut (symbolic link)
Files|file photo.jpg|Tell what type a file is
Files|stat file.txt|Show size, owner and times of a file
Files|tree|Show folders as a tree
Files|basename /a/b/c.txt|Print only the file name
Files|wc -l file.txt|Count lines (-w words, -c bytes)
Files|diff a.txt b.txt|Show the difference between two files
Files|sort file.txt|Sort the lines
Files|uniq|Remove repeated neighbouring lines
Files|cut -d, -f1 file.csv|Take one column of a CSV
Search|grep "word" file.txt|Find lines that contain a word
Search|grep -rn "word" .|Search all files below this folder
Search|grep -i "word" file|Search ignoring capital letters
Search|locate name|Find a file very fast by name
Search|awk '{print $1}' file|Print the first word of every line
Search|sed 's/old/new/g' file|Replace text in a stream
Search|xargs|Turn input lines into command arguments
Permissions|chmod 755 file|Owner all, others read and run
Permissions|chmod 644 file|Owner read and write, others read
Permissions|chmod +x script.sh|Make a script runnable
Permissions|chown user:group file|Change the owner
Permissions|sudo -i|Open a root shell (be careful)
Permissions|umask|Show default permission mask
Permissions|id|Show your user and group numbers
Permissions|groups|Show your groups
Users|adduser name|Add a new user
Users|passwd|Change your password
Users|usermod -aG sudo name|Give a user administrator rights
Users|userdel name|Delete a user
Users|su - name|Switch to another user
Users|last|Show who logged in before
Users|w|Show who is online now
System|top|Live view of processes
System|htop|A nicer top (install it first)
System|ps aux|List all running processes
System|kill 1234|Stop process number 1234 (kill -9 forces it)
System|killall name|Stop all processes with that name
System|df -h|Show free disk space
System|du -sh folder|Show the size of a folder
System|free -h|Show memory use
System|uptime|Show how long the system is on
System|lsblk|List disks
System|lscpu|Show the processor
System|lsusb|List USB devices
System|dmesg|Show kernel messages
System|journalctl -xe|Show system logs and errors
System|systemctl status nginx|Check a service
System|systemctl start nginx|Start a service
System|systemctl stop nginx|Stop a service
System|systemctl restart nginx|Restart a service
System|systemctl enable nginx|Start a service at boot
System|reboot|Restart the computer
System|shutdown -h now|Turn off the computer now
System|crontab -e|Edit your scheduled jobs
System|crontab -l|List your scheduled jobs
System|nohup cmd &|Keep a command running after you close the terminal
System|jobs|List background jobs
System|bg / fg|Move a job to background / foreground
Packages|sudo apt update|Refresh the list of packages (Ubuntu, Debian)
Packages|sudo apt upgrade|Install available updates
Packages|sudo apt install pkg|Install a program
Packages|sudo apt remove pkg|Remove a program
Packages|apt search word|Search for a package
Packages|dpkg -i file.deb|Install a .deb file
Packages|sudo dnf install pkg|Install a program (Fedora, RHEL)
Packages|sudo pacman -S pkg|Install a program (Arch)
Packages|snap install pkg|Install a snap app
Packages|pip install pkg|Install a Python package
Packages|npm install pkg|Install a Node.js package
Network|ping google.com|Test the connection
Network|ip a|Show IP addresses
Network|ip route|Show the routing table
Network|ss -tulpn|Show open ports and programs
Network|curl -I https://site.com|Show the headers of a website
Network|curl -O https://site/file.zip|Download a file
Network|wget https://site/file.zip|Download a file
Network|traceroute google.com|Show the path to a server
Network|nslookup site.com|Look up DNS records
Network|dig site.com|Detailed DNS lookup
Network|hostname -I|Show your IP addresses
Network|ssh user@host|Log in to another computer
Network|scp file user@host:/path|Copy a file to another computer
Network|rsync -avz src/ user@host:/dst/|Sync folders fast
Network|ufw status|Show the firewall state
Network|sudo ufw allow 22|Open port 22 in the firewall
Network|nmap host|Scan ports (only on your own servers)
Archive|tar -czvf a.tar.gz folder|Make a compressed archive
Archive|tar -xzvf a.tar.gz|Extract an archive
Archive|zip -r a.zip folder|Make a zip
Archive|unzip a.zip|Open a zip
Archive|gzip file|Compress a file
Archive|gunzip file.gz|Open a .gz file
Editors|nano file.txt|Simple editor (Ctrl+O save, Ctrl+X exit)
Editors|vim file.txt|Powerful editor (i insert, Esc then :wq save and quit)
Git|git clone url|Download a repository
Git|git status|Show changed files
Git|git add .|Stage all changes
Git|git commit -m "msg"|Save a snapshot
Git|git push|Upload commits
Git|git pull|Download new commits
Git|git log --oneline|Short history
Git|git checkout -b name|Make and open a new branch
Docker|docker ps|List running containers
Docker|docker images|List images
Docker|docker run -d -p 80:80 nginx|Run a container
Docker|docker stop id|Stop a container
Docker|docker compose up -d|Start all services of a project
Shortcuts|Ctrl+C|Stop the running command
Shortcuts|Ctrl+Z|Pause the running command
Shortcuts|Ctrl+R|Search your command history
Shortcuts|Ctrl+L|Clear the screen
Shortcuts|Tab|Auto-complete a name
Shortcuts|!!|Repeat the last command`;
export const LINUX = RAW.split('\n').map((l) => { const [g, c, d] = l.split('|'); return { g, c, d }; });
export const LINUX_GROUPS = [...new Set(LINUX.map((x) => x.g))];
