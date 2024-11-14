#!/bin/bash

# Create main HTML file
touch index.html

# Create styles directory and CSS files
mkdir -p styles/components
touch styles/styles.css

# Create scripts directory and JavaScript files
mkdir -p scripts
touch scripts/views/welcome.js

# Create README and LICENSE files
touch README.md
touch LICENSE

# Create .gitignore file
touch .gitignore

# Output success message
echo "Project structure created successfully!"
