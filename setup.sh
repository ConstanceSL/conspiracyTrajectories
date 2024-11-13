#!/bin/bash

# Create main HTML file
touch index.html

# Create styles directory and CSS files
mkdir -p styles/components
touch styles/styles.css

# Create scripts directory and JavaScript files
mkdir -p scripts/utils
mkdir -p scripts/views

touch scripts/main.js
touch scripts/utils/file-utils.js
touch scripts/utils/dom-utils.js
touch scripts/views/welcome.js
touch scripts/views/files-preview.js
touch scripts/views/file-view.js
touch scripts/views/row-view.js
touch scripts/file-updates.js

# Create data directory and CSV file
mkdir -p data
touch data/usernames.csv

# Create assets directory for images and icons
mkdir -p assets/images
mkdir -p assets/icons

# Create README and LICENSE files
touch README.md
touch LICENSE

# Create .gitignore file
touch .gitignore

# Output success message
echo "Project structure created successfully!"
