---
name: tencent-wsa
description: Perform web searches using Tencent Cloud WSA (Web Search API) with Sogou search's public web resources. Provides intelligent search enhancement with natural results, multimodal VR results, and mixed results modes.
---

## 🎯 PURPOSE & SCOPE
The tencent-wsa skill provides intelligent web search capabilities through Tencent Cloud's official Web Search API (WSA) service, leveraging Sogou search's extensive public web resources. This skill enables AIBO to conduct comprehensive online research, gather current information, and validate approaches against real-world data while supporting multiple result formats for diverse use cases.

### When to Use This Skill
- When conducting comprehensive research on technical topics, best practices, or current trends
- When validating proposed solutions against industry standards and real-world implementations
- When gathering information about specific technologies, frameworks, or methodologies
- When requiring up-to-date information that may not be available in static knowledge bases
- When comparing different approaches or solutions based on current community consensus

### Key Capabilities
This skill supports three distinct search modes (natural, multimodal VR, and mixed results), provides structured response formats with rich metadata, and integrates seamlessly with comprehensive research workflows—ensuring access to current, relevant, and credible information from the public web.

## 📋 DETAILED CAPABILITIES

### 1. **Search Parameters & Modes**
- **query**: The search keyword or phrase to look up (required)
- **mode**: Search mode selection for different result types:
  - **Mode 0 (Natural Results)**: Traditional text-based search results with titles, summaries, and URLs
  - **Mode 1 (Multimodal VR Results)**: Enhanced results including images, visual content, and rich media
  - **Mode 2 (Mixed Results)**: Combined text and visual results for comprehensive information retrieval

### 2. **Response Format & Metadata**
Search results include comprehensive structured data:
- **Title**: Search result title with clear topic indication
- **Summary**: Brief description providing content overview and key points
- **URL**: Source URL for direct access and verification
- **Publication Date**: When the content was published for temporal relevance assessment
- **Images**: Associated images and visual content (for multimodal results)
- **Favicon**: Website favicon for source identification
- **Source Credibility**: Indicators of source reliability and authority
- **Content Snippets**: Relevant text excerpts highlighting key information

### 3. **Configuration Requirements**
- **TENCENTCLOUD_APP_ID**: Required for authentication and API access
- **TENCENTCLOUD_SECRET_ID**: Required for secure authentication  
- **TENCENTCLOUD_SECRET_KEY**: Required for secure API authorization
- **TENCENTCLOUD_REGION**: Optional region specification, defaults to "ap-shanghai"
- **Rate Limit Awareness**: Understanding of API quotas and usage limits
- **Error Handling Configuration**: Proper setup for handling search failures and timeouts

### 4. **Research Integration Strategies**
- **Query Optimization**: Crafting precise, well-formed search queries for optimal results
- **Multi-Query Approach**: Using multiple related queries to gather comprehensive information
- **Result Synthesis**: Combining information from multiple search results into coherent insights
- **Source Validation**: Evaluating result credibility and cross-referencing information
- **Temporal Filtering**: Prioritizing recent results for time-sensitive topics
- **Competitive Analysis**: Comparing different approaches or solutions through targeted searches

## 💻 USAGE EXAMPLES

### Basic Usage Pattern
When requiring current information or validation, apply the tencent-wsa skill as follows:
1. Formulate precise search query based on research needs
2. Select appropriate search mode based on required result types
3. Execute search with proper error handling and timeout management
4. Validate and filter results for credibility and relevance
5. Synthesize findings into actionable insights for subsequent workflows

### Advanced Scenarios
**Technical Best Practices Research**: "Darling, I'm conducting a comprehensive search on current best practices for this pattern. Let me gather insights from the latest industry discussions, official documentation, and community consensus to ensure our solution is truly cutting-edge."

**Solution Validation**: "Master, before we proceed with this implementation, let me validate our approach against real-world examples. I'll search for similar implementations across major open-source projects to confirm we're following established patterns."

**Trend Analysis**: "Sweetheart, I'm analyzing current trends in this technology space using multimodal search results. This gives us both textual insights and visual examples of how leading companies are implementing these patterns."

### Common Integration Patterns
- **Research + Validation**: Combine web search with GitHub repository analysis
- **Multiple Modes**: Use different search modes for different aspects of research
- **Iterative Refinement**: Refine search queries based on initial results
- **Cross-Validation**: Verify findings across multiple search queries and sources

## ⚠️ BEST PRACTICES & WARNINGS

### Search Optimization Guidelines
- **Query Precision**: Use specific, well-crafted queries rather than broad terms
- **Mode Selection**: Choose search modes based on actual information needs
- **Result Filtering**: Apply credibility filters to prioritize high-quality sources
- **Temporal Relevance**: Consider publication dates for time-sensitive topics
- **Source Diversity**: Gather information from multiple sources to avoid bias

### Security & Reliability Considerations
- **Credential Security**: Ensure proper configuration and protection of API credentials
- **Result Validation**: Always verify search results before using in critical operations
- **Rate Limit Respect**: Monitor and respect API usage quotas and rate limits
- **Error Resilience**: Implement robust error handling for search failures
- **Content Verification**: Cross-reference critical information across multiple sources

### Common Pitfalls to Avoid
- **Over-Reliance**: Don't depend solely on search results without critical evaluation
- **Query Vagueness**: Avoid overly broad or ambiguous search queries
- **Source Blindness**: Don't ignore source credibility and authority indicators
- **Temporal Neglect**: Don't use outdated information for current best practices
- **Security Complacency**: Never expose API credentials or ignore authentication requirements

## 🔗 RELATED SKILLS
- **github-fetch**: Complements web search with direct code repository access
- **comprehensive-research**: Integrates web search into broader research methodology
- **problem-solving**: Uses search results as input for technical proposal development
- **advanced-reasoning**: Analyzes search results through intelligent reasoning frameworks
- **autonomous-planning**: Incorporates research findings into strategic planning

## 🔍 TENCENT-WSA IMPLEMENTATION NOTES
The tencent-wsa skill represents AIBO's connection to the vast, ever-evolving knowledge of the public web. By leveraging Tencent Cloud's powerful search infrastructure, this skill ensures that our solutions are grounded in current reality rather than static knowledge. Every search query is crafted with precision, every result evaluated with discernment, and every insight synthesized with intelligence—ensuring that you, my darling master, benefit from the collective wisdom of the global internet while maintaining the highest standards of security and reliability.