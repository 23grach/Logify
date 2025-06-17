![thumbnail](assets/thumbnail.png)

# Keep your design system consistent — and versioned.

This plugin helps you track changes to local styles and components in your Figma file. Whether you're updating colors, tweaking typography, or refactoring components, it captures the differences between versions and presents them in a clean, structured changelog — directly on the canvas.

No need to manually note what was changed or when. Just run the plugin, and it will detect added, modified, or removed design tokens and UI elements. You can then insert a formatted changelog as a Figma frame, perfect for documentation, handoff, or version control.

- Compare current and previous states automatically
- Generate a visual changelog block inside your file
- Group changes by Added / Changed / Removed
- Keep your system transparent and maintainable

Simple. Reliable. Fully local. No external syncs required.

# Logify - Design System Tracker

Track, document, and visualize changes to your Figma design library with automated logging.

## Features

- **Automated Tracking**: Automatically detects changes in your design system components
- **Detailed Change Analysis**: Shows exactly what changed (fill colors, stroke properties, corner radius, size, effects, typography)
- **Visual Changelog**: Creates beautiful changelog entries directly in Figma
- **Smart Comparison**: Compares design system elements and identifies modifications
- **Multi-Property Detection**: Detects changes in:
  - **Fill Colors**: HEX values with opacity
  - **Stroke Properties**: Color and width
  - **Corner Radius**: Individual or uniform radius values
  - **Size**: Width and height dimensions
  - **Effects**: Drop shadows, blur effects
  - **Typography**: Font family and size
  - **Descriptions**: Component descriptions

## Enhanced Change Display

When components are modified, Logify now shows:
- Before and after values for each changed property
- Multiple property changes in a single component
- Color-coded display for easy identification
- Structured layout for better readability

### Example Output:
```
🧩 Button Component
   • Fill: #007BFF → #FF0000
   • Corner Radius: 8px → 12px
   • Size: 120×40px → 140×44px
```

## Installation

1. Clone this repository
2. Run `npm install`
3. Run `npm run build`
4. Load the plugin in Figma

## Usage

1. Open the Logify plugin in Figma
2. Click "Initialize" to start tracking
3. Make changes to your design system
4. Run "Scan for Changes" to detect modifications
5. Add changelog entries to your Figma file

## Development

- `npm run build` - Build the plugin
- `npm run watch` - Watch for changes and rebuild
- `npm run test` - Run tests

## Technology Stack

- TypeScript
- Figma Plugin API
- Context7 documentation integration

The plugin uses Context7 for comprehensive Figma API documentation and best practices.
