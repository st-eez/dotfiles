```          __                        
  _______/  |_  ____   ____ ________
 /  ___/\   __\/ __ \_/ __ \\___   /
 \___ \  |  | \  ___/\  ___/ /    / 
/____  > |__|  \___  >\___  >_____ \
     \/            \/     \/      \/
```
# Dotfiles Setup

### 1. Install dependencies
```bash
export RUNZSH=no
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
git clone --depth=1 https://github.com/romkatv/powerlevel10k ${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/themes/powerlevel10k
git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/plugins/zsh-autosuggestions
git clone https://github.com/zsh-users/zsh-syntax-highlighting ${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting
```

### 2. Clone and apply your dotfiles
```bash
git clone https://github.com/st-eez/dotfiles.git ~/dotfiles
cp ~/dotfiles/zsh/.zshrc ~/
cp ~/dotfiles/zsh/.zprofile ~/
cp ~/dotfiles/zsh/.p10k.zsh ~/
mkdir -p ~/.config/ghostty && cp ~/dotfiles/ghostty/config ~/.config/ghostty/
exec zsh
```
