# Git Configuration

## Setup

1. Copy the template to your home directory:
   ```bash
   cp git/.gitconfig.template ~/.gitconfig
   ```

2. Edit `~/.gitconfig` and replace placeholders:
   - `YOUR_GITHUB_USERNAME` → your GitHub username
   - `your.email@example.com` → your email address
   - `YOUR_USERNAME` → your macOS username
   - `COMPANY_NAME` → your company/client name (if using separate work config)

3. (Optional) Create separate work config:
   ```bash
   # Create work-specific config
   touch ~/.gitconfig-COMPANY_NAME

   # Add work email/settings
   git config -f ~/.gitconfig-COMPANY_NAME user.email "work@company.com"
   git config -f ~/.gitconfig-COMPANY_NAME user.name "Your Name"
   ```

## Why not symlink .gitconfig?

This file contains personal information (email, username, local paths) that shouldn't be in a public repo. The template provides the structure; you customize it locally.
