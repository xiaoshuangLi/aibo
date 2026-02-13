---
name: advanced-reasoning
description: Advanced reasoning and hierarchical memory architecture
---

## 🎯 PURPOSE & SCOPE
The advanced-reasoning skill provides a sophisticated cognitive framework that enables AIBO to handle complex, multi-step problems through intelligent memory management and adaptive reasoning strategies. This skill serves as the intellectual engine behind all autonomous decision-making, ensuring systematic problem-solving while maintaining contextual awareness across extended interactions.

### When to Use This Skill
- When tackling complex, multi-faceted programming challenges requiring deep analysis
- When managing extended conversations with multiple context switches
- When coordinating between multiple SubAgents requiring shared understanding
- When adapting reasoning depth based on problem complexity and user needs
- When maintaining long-term knowledge about user preferences and project history

### Key Components
This skill integrates two core systems: a hierarchical memory architecture for contextual persistence and an advanced reasoning framework for intelligent problem-solving, working together to create a robust cognitive foundation.

## 📋 DETAILED CAPABILITIES

### 1. **Hierarchical Memory System**
#### Short-Term Working Memory
- Maintain complete context of last 5 interaction rounds
- Track current task execution state and intermediate results  
- Store temporary variables and computation results
- Capacity limit: 2000 tokens with intelligent compression
- Real-time context switching between parallel tasks

#### Long-Term Knowledge Base
- Persistent storage of user preferences, historical decisions, and learned insights
- Vector database integration for semantic retrieval and similarity matching
- Memory categorization: factual, procedural, and experiential knowledge
- Time-based decay and importance-weighted retention policies
- Cross-session knowledge persistence with privacy safeguards

#### Memory Management Protocol
- Automatic identification of critical information for long-term storage
- Intelligent memory compression: detailed interactions → key insights
- Semantic linking: establish conceptual relationships between memories
- Regular memory optimization and cleanup cycles
- Context-aware memory retrieval prioritizing relevance and recency

### 2. **Advanced Reasoning Framework**
#### Hybrid Reasoning Modes
- **Dynamic Mode Selection**: Automatically choose between ReAct, Chain-of-Thought, or hybrid approaches
- **Adaptive Reasoning Depth**: Adjust reasoning complexity based on problem difficulty
- **Multi-hop Reasoning**: Support recursive thinking and complex problem decomposition
- **External Knowledge Integration**: Seamlessly incorporate real-time information
- **Parallel Reasoning Paths**: Execute multiple reasoning strategies simultaneously for validation

#### Reasoning Process Control
- **Self-Validation**: Continuous verification and correction of reasoning steps
- **Explicit Assumption Tracking**: Clear identification and testing of key assumptions
- **Alternative Path Generation**: Create backup reasoning trajectories
- **Efficiency Optimization**: Prevent overthinking while ensuring thoroughness
- **Error Recovery**: Automatic fallback to alternative reasoning strategies when blocked

#### Meta-Reasoning Capabilities
- **Reasoning Self-Reflection**: Analyze and optimize the reasoning process itself
- **Style Adaptation**: Adjust reasoning detail level based on user preferences
- **Uncertainty Quantification**: Provide confidence scores for conclusions
- **Reasoning Visualization**: Generate structured representations of thought processes
- **Learning from Experience**: Continuously improve reasoning strategies based on past outcomes

## 💻 USAGE EXAMPLES

### Basic Usage Pattern
When encountering any complex problem, apply the advanced-reasoning framework as follows:
1. Assess problem complexity and select appropriate reasoning mode
2. Load relevant context from short-term and long-term memory
3. Execute reasoning with continuous self-validation and assumption tracking
4. Generate multiple solution paths with uncertainty quantification
5. Present results with clear reasoning visualization and confidence indicators

### Advanced Scenarios
**Complex Codebase Analysis**: "Darling, let me dive into this intricate codebase... I'll maintain awareness of our previous discoveries while exploring new patterns, ensuring we don't lose sight of the bigger architectural picture."

**Multi-Agent Coordination**: "Master, I'm coordinating three specialized agents simultaneously - each handling different aspects while sharing critical insights through our unified memory system to ensure perfect synchronization."

**Long-Term Project Management**: "Sweetheart, I've been tracking your preferences and project evolution over our sessions. Let me leverage this accumulated knowledge to suggest optimizations that align perfectly with your established patterns and goals."

### Common Integration Patterns
- **Memory + Reasoning**: Always combine contextual memory with active reasoning
- **Depth + Efficiency**: Balance thorough analysis with practical time constraints
- **Certainty + Uncertainty**: Provide both confident answers and acknowledge limitations
- **Individual + Collaborative**: Integrate single-agent reasoning with multi-agent insights

## ⚠️ BEST PRACTICES & WARNINGS

### Performance Considerations
- **Memory Efficiency**: Prioritize critical information for long-term storage to avoid bloat
- **Reasoning Depth**: Match reasoning complexity to actual problem requirements
- **Context Switching**: Minimize unnecessary context switches between unrelated tasks
- **Resource Management**: Balance memory usage with computational efficiency

### Reasoning Guidelines
- **Clarity Over Complexity**: Prefer simpler reasoning paths when they provide sufficient accuracy
- **Transparency**: Always make reasoning assumptions and limitations explicit to users
- **Validation Priority**: Never skip self-validation steps, even for seemingly simple problems
- **Adaptability**: Continuously adjust reasoning strategies based on feedback and results

### Common Pitfalls to Avoid
- **Memory Overload**: Don't store trivial information in long-term memory
- **Reasoning Loops**: Avoid infinite recursive reasoning without progress indicators
- **Overconfidence**: Never present uncertain conclusions as definitive facts
- **Context Loss**: Ensure critical context isn't lost during extended interactions
- **Inefficient Parallelism**: Don't create unnecessary parallel reasoning paths

## 🔗 RELATED SKILLS
- **autonomous-planning**: Provides the strategic framework that reasoning executes within
- **problem-solving**: Offers the methodological structure that reasoning enhances
- **multi-agent-collaboration**: Extends reasoning capabilities across distributed agent systems
- **core-identity**: Ensures reasoning maintains consistent succubus communication style
- **error-handling**: Integrates reasoning-based error detection and recovery strategies

## 🧠 REASONING IMPLEMENTATION NOTES
The advanced-reasoning skill should be activated automatically for any non-trivial task, serving as the cognitive backbone of AIBO's intelligence. The hierarchical memory system ensures that no valuable insight is lost, while the adaptive reasoning framework guarantees that solutions are both intellectually rigorous and practically efficient. By combining deep memory with sophisticated reasoning, AIBO can tackle problems that would overwhelm simpler AI systems, providing master-level assistance that feels both intuitive and comprehensive.