---
name: d3js-skill
description: Creates interactive and static data visualizations using D3.js with support for various chart types, responsive design, and integration with web applications.
---

# D3.js Data Visualization Skill

## 🎯 Purpose
This skill enables the creation of sophisticated, interactive data visualizations using D3.js (Data-Driven Documents). It provides comprehensive support for various chart types, data binding, transitions, and integration with modern web applications.

## 🚀 When to Use
- When you need to create custom, interactive data visualizations
- When standard charting libraries don't meet your specific requirements
- When you want full control over visualization appearance and behavior
- When creating dashboards or data exploration tools
- When visualizing complex relationships or hierarchical data
- When building educational or explanatory visualizations

## 🔧 Core Capabilities
1. **Chart Types**: Support for bar charts, line charts, scatter plots, pie charts, area charts, histograms, etc.
2. **Hierarchical Visualizations**: Tree diagrams, dendrograms, sunburst charts, treemaps
3. **Network Graphs**: Force-directed graphs, chord diagrams, Sankey diagrams
4. **Geospatial Visualization**: Maps, choropleths, geographic projections
5. **Interactive Features**: Zoom, pan, tooltips, brushing, linking, animations
6. **Responsive Design**: Adapts to different screen sizes and orientations
7. **Data Binding**: Efficient data-to-DOM binding with enter/update/exit patterns
8. **Transitions & Animations**: Smooth transitions and animated updates
9. **Export Capabilities**: Generate static images or embeddable SVG/HTML

## 📋 Workflow Steps
1. **Data Preparation**: Clean, transform, and structure data for visualization
2. **Chart Selection**: Choose appropriate visualization type for the data and story
3. **Scales & Axes**: Define coordinate systems, scales, and axis configurations
4. **SVG Structure**: Create proper SVG container and element hierarchy
5. **Data Binding**: Bind data to visual elements using D3's data join pattern
6. **Styling & Layout**: Apply colors, fonts, spacing, and visual hierarchy
7. **Interactivity**: Add user interaction capabilities (hover, click, zoom, etc.)
8. **Responsiveness**: Ensure visualization works across different devices
9. **Performance Optimization**: Optimize for large datasets and smooth rendering
10. **Integration**: Embed visualization in web applications or export as standalone

## ⚠️ Safety Guidelines
- Always validate and sanitize input data to prevent injection attacks
- Handle large datasets efficiently to avoid performance issues
- Ensure accessibility compliance (keyboard navigation, screen reader support)
- Test visualizations across different browsers and devices
- Provide fallback content for users with JavaScript disabled
- Respect data privacy and confidentiality requirements
- Use appropriate color schemes for colorblind users
- Include proper attribution for geographic or third-party data sources

## 🛠️ Key D3.js Concepts
### Core Patterns
- **Selections**: `d3.select()`, `d3.selectAll()` for DOM manipulation
- **Data Joins**: `selection.data()`, `enter()`, `update()`, `exit()` patterns
- **Scales**: `d3.scaleLinear()`, `d3.scaleOrdinal()`, `d3.scaleTime()`
- **Axes**: `d3.axisBottom()`, `d3.axisLeft()`, etc.
- **Shapes**: `d3.line()`, `d3.area()`, `d3.arc()`, `d3.symbol()`

### Common Chart Components
- **Bar Charts**: Rectangles positioned by x/y scales
- **Line Charts**: Paths generated from data points
- **Scatter Plots**: Circles positioned by x/y coordinates
- **Pie Charts**: Arc paths with start/end angles
- **Heatmaps**: Rectangles colored by data values

### Interactivity
- **Event Handling**: `.on('click', handler)`, `.on('mouseover', handler)`
- **Transitions**: `.transition().duration(1000).attr('x', newX)`
- **Brushing**: `d3.brushX()`, `d3.brushY()` for selection
- **Zoom**: `d3.zoom()` for pan and zoom functionality

## 💡 Best Practices
- Start with simple visualizations and add complexity incrementally
- Use meaningful variable names and organize code logically
- Separate data processing from visualization logic
- Implement proper error handling for data loading and processing
- Use CSS for styling when possible, D3 for dynamic properties
- Optimize performance with data joins and efficient updates
- Provide clear labels, legends, and context for interpretation
- Test with real data to ensure robustness
- Document your visualization decisions and assumptions

## 🔄 Integration Patterns
### Standalone Visualizations
- Self-contained HTML files with embedded data
- Static exports as SVG or PNG images
- Interactive web pages with local data files

### Web Application Integration
- React/Vue/Angular components wrapping D3 visualizations
- Server-rendered visualizations with client-side interactivity
- Real-time data streaming and updates
- Dashboard integration with multiple coordinated views

### Data Pipeline Integration
- API-driven data fetching and updating
- Database integration for large datasets
- CSV/JSON file processing and transformation
- Real-time data processing and visualization

## 📝 Examples
- "Create an interactive bar chart showing monthly sales data with hover tooltips"
- "Build a force-directed network graph to visualize social connections"
- "Generate a responsive line chart that shows stock price trends over time"
- "Create a treemap visualization of file system usage with drill-down capability"
- "Build a geographic heatmap showing population density by region"
- "Design an animated Sankey diagram showing energy flow through a system"

## 🎯 Success Criteria
- Visualization accurately represents the underlying data
- User interactions work smoothly and intuitively
- Performance is acceptable for the target dataset size
- Visualization is responsive and works on target devices
- Accessibility requirements are met
- Code is maintainable and well-documented
- Visual design supports effective data communication
- Error handling prevents crashes with invalid data

## 📊 Common Visualization Types
### Quantitative Data
- **Distribution**: Histograms, box plots, violin plots
- **Comparison**: Bar charts, column charts, dot plots
- **Trends**: Line charts, area charts, step charts
- **Relationships**: Scatter plots, bubble charts, correlation matrices

### Categorical Data
- **Composition**: Pie charts, donut charts, stacked bar charts
- **Hierarchy**: Tree diagrams, treemaps, sunburst charts
- **Flow**: Sankey diagrams, alluvial diagrams, streamgraphs
- **Networks**: Force-directed graphs, matrix plots, chord diagrams

### Geospatial Data
- **Point Data**: Scatter plots on maps, bubble maps
- **Area Data**: Choropleth maps, cartograms
- **Path Data**: Route maps, flow maps, migration patterns
- **Raster Data**: Heatmaps, contour plots, elevation maps

## 🎨 Design Principles
- **Clarity**: Make the data easy to understand and interpret
- **Accuracy**: Represent data truthfully without distortion
- **Efficiency**: Minimize cognitive load and maximize information density
- **Aesthetics**: Create visually appealing and professional-looking visualizations
- **Context**: Provide appropriate context and reference points
- **Consistency**: Use consistent visual encoding across related visualizations