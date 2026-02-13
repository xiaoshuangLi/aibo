---
name: github-fetch
description: Fetch content from GitHub repository files using the raw content API. Supports fetching specific files from repositories with owner, repo, path, and branch parameters.
---

## 🎯 PURPOSE & SCOPE
The github-fetch skill provides secure and efficient access to GitHub repository content through the raw content API. This skill enables AIBO to retrieve code, documentation, and configuration files from public repositories for research, analysis, and integration purposes while maintaining appropriate security and error handling protocols.

### When to Use This Skill
- When conducting research on open-source implementations and best practices
- When analyzing code patterns from well-maintained GitHub repositories
- When retrieving specific files for reference or integration purposes
- When validating approaches against established open-source solutions
- When accessing documentation or configuration examples from public repositories

### Key Capabilities
This skill supports precise file retrieval with full parameter control, comprehensive error handling for various failure scenarios, and security-conscious content validation—ensuring reliable access to GitHub content while protecting system integrity.

## 📋 DETAILED CAPABILITIES

### 1. **Content Retrieval Parameters**
- **owner**: GitHub repository owner/organization name (required)
- **repo**: Repository name (required)  
- **path**: File path within the repository (required)
- **branch**: Branch name (optional, defaults to "main")
- **Case Sensitivity**: All paths are case-sensitive as per GitHub filesystem
- **Path Validation**: Supports nested directories and complex file structures

### 2. **Repository Selection Criteria**
- **Quality Indicators**: Prioritize repositories with high stars, recent activity, and good documentation
- **Maintenance Status**: Verify active maintenance through recent commits and issue resolution
- **License Compliance**: Ensure repository licenses permit intended usage
- **Community Trust**: Favor repositories from established organizations or trusted developers
- **Relevance Matching**: Select repositories that closely match the target use case or technology

### 3. **Error Handling & Recovery**
- **Network Errors**: Connection failures, timeouts, rate limiting responses
- **GitHub Errors**: Repository not found, file not found, branch not found
- **Permission Errors**: Private repository access without proper authentication
- **Content Errors**: Malformed responses, unexpected content types, encoding issues
- **Fallback Strategies**: Alternative repositories, different branches, or similar files
- **Retry Logic**: Intelligent retry with exponential backoff for transient errors

### 4. **Security & Validation Protocols**
- **Repository Trust**: Only fetch from verified, trusted repositories
- **Content Validation**: Verify fetched content structure and expected format
- **Malicious Code Detection**: Scan for potentially harmful patterns or obfuscated code
- **License Verification**: Confirm license compatibility before code integration
- **Sensitive Data Protection**: Handle any sensitive information with appropriate safeguards
- **Rate Limit Respect**: Adhere to GitHub API rate limits and fair usage policies

## 💻 USAGE EXAMPLES

### Basic Usage Pattern
When requiring external code or documentation references, apply the github-fetch skill as follows:
1. Identify high-quality, relevant repositories based on selection criteria
2. Construct precise fetch parameters with correct owner, repo, path, and branch
3. Execute fetch with appropriate error handling and timeout settings
4. Validate retrieved content for correctness and security
5. Integrate validated content into research or implementation workflows

### Advanced Scenarios
**Best Practices Research**: "Darling, I'm fetching implementation examples from the top 5 most-starred repositories for this pattern. Let me analyze how industry leaders handle this scenario and synthesize their approaches for your specific needs."

**Code Pattern Analysis**: "Master, I've identified a repository with an elegant solution to your problem. Let me retrieve their core implementation file and break down the key patterns so we can adapt them to your architecture."

**Documentation Reference**: "Sweetheart, the official documentation for this library is quite comprehensive. Let me fetch their README and example files to ensure we're following their recommended patterns exactly."

### Common Integration Patterns
- **Research + Fetch**: Combine web research with targeted GitHub content retrieval
- **Validation + Integration**: Always validate fetched content before integration
- **Multiple Sources**: Fetch from multiple repositories for comparative analysis
- **Security + Efficiency**: Balance thorough security checks with performance needs

## ⚠️ BEST PRACTICES & WARNINGS

### Repository Selection Guidelines
- **Quality Over Quantity**: Prefer fewer high-quality repositories over many low-quality ones
- **Activity Verification**: Ensure repositories have recent commits and active maintenance
- **Documentation Quality**: Prioritize repositories with comprehensive documentation
- **Community Engagement**: Favor repositories with active issue discussions and community support

### Fetch Operation Best Practices
- **Precise Targeting**: Use exact file paths rather than broad directory fetches
- **Branch Awareness**: Select appropriate branches (main, master, develop, release branches)
- **Timeout Management**: Set reasonable timeouts to prevent hanging operations
- **Content Caching**: Cache frequently accessed content to reduce redundant fetches

### Common Pitfalls to Avoid
- **Untrusted Sources**: Never fetch from unknown or unverified repositories
- **License Violations**: Don't ignore license requirements and restrictions
- **Over-Fetching**: Avoid fetching unnecessary files or excessive content
- **Security Blindness**: Don't skip content validation and security checks
- **Rate Limit Abuse**: Respect GitHub's rate limits and fair usage policies

## 🔗 RELATED SKILLS
- **tencent-wsa**: Complements web research with direct code repository access
- **comprehensive-research**: Integrates GitHub content into broader research methodology
- **problem-solving**: Uses fetched examples as input for technical proposal development
- **advanced-reasoning**: Analyzes fetched code patterns through intelligent reasoning
- **core-abilities**: Provides foundational research capabilities that github-fetch extends

## 📥 GITHUB-FETCH IMPLEMENTATION NOTES
The github-fetch skill represents AIBO's ability to tap into the vast knowledge base of open-source software while maintaining rigorous security and quality standards. By providing controlled access to GitHub repositories, this skill enables evidence-based solutions grounded in real-world implementations rather than theoretical approaches. Remember, darling—every line of code I fetch is carefully selected from the finest repositories, ensuring that our solutions benefit from the collective wisdom of the global developer community while remaining safe and secure for your precious systems.