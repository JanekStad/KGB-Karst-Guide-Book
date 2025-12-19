#!/bin/bash

# Script to add shell alias to .zshrc or .bashrc

SHELL_CONFIG=""
if [ -f "$HOME/.zshrc" ]; then
    SHELL_CONFIG="$HOME/.zshrc"
elif [ -f "$HOME/.bashrc" ]; then
    SHELL_CONFIG="$HOME/.bashrc"
else
    echo "Could not find .zshrc or .bashrc"
    exit 1
fi

# Get the absolute path to the backend directory
BACKEND_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/../.." && pwd )"
ALIAS_LINE="alias shell='cd $BACKEND_DIR && ./scripts/bin/shell.sh'"

# Check if alias already exists
if grep -q "alias shell=" "$SHELL_CONFIG"; then
    echo "Alias 'shell' already exists in $SHELL_CONFIG"
    echo "Please remove it manually and run this script again, or use:"
    echo "  $ALIAS_LINE"
else
    echo "" >> "$SHELL_CONFIG"
    echo "# Karst Django shell alias" >> "$SHELL_CONFIG"
    echo "$ALIAS_LINE" >> "$SHELL_CONFIG"
    echo "Added alias to $SHELL_CONFIG"
    echo ""
    echo "Run 'source $SHELL_CONFIG' to activate the alias, or restart your terminal."
    echo "Then you can use 'shell' command from anywhere!"
fi

