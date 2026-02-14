---
name: playwright-skill
description: Enables browser automation and web application testing using Playwright with comprehensive interaction capabilities, screenshot capture, and validation workflows.
---

# Playwright Skill

## 🎯 Purpose
This skill provides comprehensive browser automation capabilities using Playwright, enabling automated testing, validation, and interaction with web applications. It supports multiple browsers (Chromium, Firefox, WebKit) and provides robust tools for end-to-end testing and web scraping.

## 🚀 When to Use
- When you need to automate browser interactions for testing web applications
- When validating frontend functionality and user experience
- When capturing screenshots or recording browser sessions for documentation
- When performing web scraping or data extraction from websites
- When testing responsive design across different viewport sizes
- When verifying web application behavior under various conditions

## 🔧 Core Capabilities
1. **Browser Automation**: Navigate, click, type, and interact with web elements
2. **Multi-Browser Support**: Test across Chromium, Firefox, and WebKit
3. **Screenshot Capture**: Take full-page or element-specific screenshots
4. **Network Monitoring**: Intercept and analyze network requests/responses
5. **Form Handling**: Fill forms, select options, and handle file uploads
6. **Authentication**: Handle login flows and session management
7. **Responsive Testing**: Test across different device sizes and orientations
8. **Performance Metrics**: Capture load times and performance data
9. **Error Handling**: Robust error detection and recovery mechanisms

## 📋 Workflow Steps
1. **Environment Setup**: Initialize Playwright with appropriate browser and options
2. **Page Navigation**: Navigate to target URLs and handle redirects
3. **Element Interaction**: Click buttons, fill forms, select options, etc.
4. **Validation**: Verify expected outcomes and assert conditions
5. **Screenshot/Recording**: Capture visual evidence of test results
6. **Cleanup**: Properly close browser instances and cleanup resources
7. **Result Reporting**: Generate comprehensive test reports

## ⚠️ Safety Guidelines
- Always use headless mode for production environments unless visual debugging is needed
- Implement proper timeout handling to prevent hanging tests
- Respect website terms of service when performing web scraping
- Handle sensitive data securely (avoid logging credentials)
- Use appropriate wait strategies instead of fixed delays
- Clean up browser instances to prevent resource leaks
- Test on staging environments before production

## 🛠️ Key Playwright Features
### Navigation & Interaction
- `page.goto(url)` - Navigate to URL
- `page.click(selector)` - Click elements
- `page.fill(selector, value)` - Fill input fields
- `page.selectOption(selector, values)` - Select dropdown options
- `page.press(selector, key)` - Press keyboard keys

### Assertions & Validation
- `expect(locator).toBeVisible()` - Check visibility
- `expect(page).toHaveURL(url)` - Verify URL
- `expect(locator).toHaveText(text)` - Check text content
- `expect(response).toBeOK()` - Verify HTTP status

### Screenshots & Media
- `page.screenshot()` - Capture full page screenshot
- `locator.screenshot()` - Capture specific element
- `page.video()` - Record video of browser session
- `page.pdf()` - Generate PDF (Chromium only)

### Network & Performance
- `page.route()` - Intercept and mock network requests
- `page.waitForResponse()` - Wait for specific responses
- `page.metrics()` - Get performance metrics
- `page.setExtraHTTPHeaders()` - Set custom headers

## 💡 Best Practices
- Use semantic selectors (data-testid, role attributes) over fragile CSS selectors
- Implement proper waiting strategies using Playwright's auto-waiting
- Structure tests to be independent and idempotent
- Use fixtures for common setup/teardown operations
- Parameterize tests for different scenarios and data sets
- Implement retry logic for flaky tests
- Use parallel execution for faster test runs
- Generate meaningful test reports with visual evidence

## 🔄 Integration with Development Workflow
- **CI/CD Integration**: Run tests as part of continuous integration pipeline
- **Visual Regression**: Compare screenshots to detect UI changes
- **Accessibility Testing**: Verify accessibility compliance
- **Performance Monitoring**: Track performance metrics over time
- **Cross-Browser Testing**: Ensure consistent behavior across browsers
- **Mobile Testing**: Test responsive design on mobile viewports

## 📝 Examples
- "Test the user registration flow and capture screenshots of each step"
- "Verify that the shopping cart updates correctly when adding items"
- "Scrape product data from the e-commerce website for analysis"
- "Test the responsive layout on mobile, tablet, and desktop viewports"
- "Validate that form validation errors display correctly for invalid inputs"
- "Capture a video recording of the checkout process for review"

## 🎯 Success Criteria
- Tests execute reliably without flakiness
- All assertions pass for expected behavior
- Screenshots/videos provide clear visual evidence
- Performance metrics meet defined thresholds
- Cross-browser compatibility is verified
- Error handling works correctly for edge cases
- Resource cleanup is performed properly
- Test reports are comprehensive and actionable

## 📊 Common Use Cases
### End-to-End Testing
- User journey validation
- Critical path testing
- Integration testing
- Regression testing

### Visual Testing
- Screenshot comparison
- Layout validation
- Responsive design verification
- Brand consistency checks

### Data Extraction
- Web scraping
- Content monitoring
- Price tracking
- Social media monitoring

### Performance Testing
- Load time measurement
- Resource usage analysis
- Network performance
- Memory leak detection