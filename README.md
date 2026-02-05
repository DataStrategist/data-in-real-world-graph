# Data in the Real World - Knowledge Graph Visualization

**Live Site:** https://data-in-real-world-graph.netlify.app  
**GitHub:** https://github.com/DataStrategist/data-in-real-world-graph

Interactive knowledge graph visualization for the "Data in the Real World" 52-week LinkedIn video series. Each video explores data management concepts, organizational dysfunction, and AI strategy - this graph maps how they all connect.

---

## Concept

```mermaid
graph TB
    VS[Video Series<br/>52-week LinkedIn series] --> V1[Video 1<br/>Excel's Three Jobs]
    VS --> V2[Video 2<br/>$500k Project Failure]
    VS --> V3[Video 3<br/>Next Year's Questions]
    VS --> V4[Video 4<br/>Datasets as Arguments]
    
    V1 --> T1[Topic: Excel]
    V1 --> T2[Topic: Separation of Concerns]
    V1 --> T3[Topic: Three Jobs Anti-Pattern]
    
    V2 --> T4[Topic: Data Governance]
    V2 --> T5[Topic: Ownership Gap]
    V2 --> T1
    
    V3 --> T6[Topic: Disaggregated Data]
    V3 --> T7[Topic: Data Aggregation]
    V3 --> T1
    
    V4 --> T8[Topic: AI Bias]
    V4 --> T9[Topic: Measurement Bias]
    V4 --> T10[Topic: Power Decides Data]
    
    T1 --> Track[Track A: Tactical]
    T4 --> Track2[Track B: Governance]
    T8 --> Track3[Track C: AI]
    
    style VS fill:#FFD97D,stroke:#333,stroke-width:3px
    style V1 fill:#FFD97D,stroke:#333
    style V2 fill:#FFD97D,stroke:#333
    style V3 fill:#FFD97D,stroke:#333
    style V4 fill:#FFD97D,stroke:#333
    style T1 fill:#E8F5E9,stroke:#333
    style T2 fill:#E8F5E9,stroke:#333
    style T3 fill:#E8F5E9,stroke:#333
    style T4 fill:#E8F5E9,stroke:#333
    style T5 fill:#E8F5E9,stroke:#333
    style T6 fill:#E8F5E9,stroke:#333
    style T7 fill:#E8F5E9,stroke:#333
    style T8 fill:#E8F5E9,stroke:#333
    style T9 fill:#E8F5E9,stroke:#333
    style T10 fill:#E8F5E9,stroke:#333
```

**How it works:**
- **Videos** (yellow nodes) cover specific data management scenarios
- **Topics** (green nodes) are reusable concepts that appear across multiple videos
- **Tracks** organize topics by level: A = Tactical, B = Governance, C = AI
- **Relationships** show which topics each video discusses
- **The graph reveals patterns**: Excel appears in 3 videos, governance issues connect to AI bias, tactical problems cascade into strategic failures

---

## Architecture

```mermaid
flowchart TD
    A[Browser Client] -->|HTTP GET| B[Netlify CDN]
    B -->|Serves| C[Static HTML/CSS/JS]
    C -->|Loads in browser| A
    A -->|Fetch /graph| D[Netlify Serverless Function]
    D -->|Cypher Query| E[Neo4J AuraDB]
    E -->|Graph Data| D
    D -->|Cache 5min| D
    D -->|JSON Response| A
    A -->|Renders with| F[vis-network.js]
    F -->|Updates| A
    
    style E fill:#4ECDC4,stroke:#333,stroke-width:2px
    style D fill:#FFE66D,stroke:#333,stroke-width:2px
    style C fill:#95E1D3,stroke:#333,stroke-width:2px
```

### Frontend (`index.html`)
- Single-page application using [vis-network](https://visjs.github.io/vis-network/)
- Interactive graph with hover tooltips, click-to-highlight
- Mobile-responsive (emoji-only buttons, scrollable modal)
- Search dropdown for finding specific nodes
- Yellow "🔗 View Video" button appears when clicking Video nodes

### Backend (`netlify/functions/graph.js`)
- Serverless function runs on Netlify
- Connects to Neo4J AuraDB (credentials in environment variables)
- Query: `MATCH (n) OPTIONAL MATCH (n)-[r]-(m) RETURN n, r, m LIMIT 1200`
- 5-minute cache to reduce database load
- Returns JSON formatted for vis-network

### Security
- ✅ Neo4J credentials never exposed to browser
- ✅ Read-only queries only
- ✅ Rate limiting via caching
- ✅ Bounded queries (max 1200 rows)

---

## Neo4J Schema

### Node Types
- **VideoSeries**: The overarching 52-week series
- **Video**: Individual published episodes with LinkedIn URLs, metrics
- **Topic**: Concepts, problems, principles discussed in videos
- **Track**: Content categories (A/B/C for tactical/governance/AI)

### Relationships
- `part_of`: Videos belong to series, topics belong to tracks
- `discusses`: Videos discuss topics
- `related_to`: Topics connect to other topics

### Properties

**Video nodes:**
- `number`: Episode number (1-4 published so far)
- `name`: Video title
- `linkedin_url`: Link to LinkedIn post
- `published_date`: YYYY-MM-DD
- `track`: A, B, or C
- `impressions_7day`, `reach_7day`, `reactions_7day`, `comments_7day`: Engagement metrics

**Topic nodes:**
- `name`: Concept name ("Excel", "Data Governance", "AI Bias")
- `category`: Type (Tool, Concept, Problem, Principle, etc.)
- `description`: Explanation of the concept

---

## Tech Stack

- **Graph Database**: Neo4J AuraDB (free tier)
- **Backend**: Node.js serverless function on Netlify
- **Frontend**: Vanilla JS + vis-network.js
- **Hosting**: Netlify (free tier)
- **Analytics**: Google Analytics 4
- **Source Control**: GitHub

---

## Credits

Built by Amit Kohli as part of the "Data in the Real World" LinkedIn series.  
**Connect:** [LinkedIn](https://www.linkedin.com/in/amitkohli1/) • [Website](https://amitkohli.com)  
**Series Overview:** 52-week exploration of data management, organizational dysfunction, and AI strategy in social care.
