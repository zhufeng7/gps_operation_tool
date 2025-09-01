# 推特运营数据分析工具 - 产品需求文档 (PRD)

## 产品概述

**产品名称**: Twitter Analytics Pro  
**技术架构**: Next.js 15 + Supabase + GPT5/DeepSeek  
**目标用户**: Web3项目运营团队、KOL、营销机构

## 核心功能模块

### 功能1: 图片推文检索与下载系统

**页面路径**: `/app/media-search/page.tsx`

#### 页面结构优化

**搜索区域**
- 输入框: @username
- [检索按钮] [清空]

**结果展示区域**
- 📊 统计信息
  - 总推文数: 1,234
  - 含图片: 456
  - 检索时间: 2024/1/1
- 📥 下载选项
  - [下载链接CSV] [下载JSON]
  - [复制到剪贴板]

**预览区域**
- 📷 图片推文预览 (分页)
- [推文1] [推文2] ...
- 每页20条，支持无限滚动

#### 核心功能
- 实时检索，不存储数据库
- 支持CSV/JSON格式下载
- 推文链接批量导出
- 图片缩略图预览
- 检索进度条显示
- 支持检索结果筛选

### 功能2: 多账号综合分析系统 (基于模板设计)

#### 2.1 项目结构优化

```
/app
├── layout.tsx                 # 全局布局
├── page.tsx                  # 首页 - 功能导航
├── media-search/             # 功能1: 图片推文检索
│   └── page.tsx             # 主检索页面
├── analytics/               # 功能2: 综合分析系统
│   ├── page.tsx            # 分析首页
│   ├── account-info/       # 2.1 账号基础信息
│   │   └── page.tsx
│   ├── tweet-collection/   # 2.2 推文数据收集  
│   │   └── page.tsx
│   ├── dashboard/          # 2.3 二维数据分析
│   │   └── page.tsx
│   └── reports/            # 2.4 策略报告生成
│       └── page.tsx
└── protected/              # 用户认证页面 (现有)
```

#### 2.2 账号基础信息分析 (参考gps3.jpg)

**页面**: `/app/analytics/account-info/page.tsx`

**UI设计**:
- 表格式信息展示 (类似Excel)
- 支持多账号并行分析
- 账号对比视图
- 历史数据趋势图

**数据字段** (实时获取，存储分析结果):

```sql
CREATE TABLE account_profiles (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50),
  twitter_link TEXT,
  website TEXT,  
  followers_count INTEGER,
  account_created_at TIMESTAMP,
  first_tweet_date TIMESTAMP,
  total_tweets_count INTEGER,
  profile_description TEXT,
  avatar_history JSONB,
  key_events JSONB,
  analysis_date TIMESTAMP
);
```

#### 2.3 推文数据收集表 (参考gps2.jpg)

**页面**: `/app/analytics/tweet-collection/page.tsx`

**表格结构**:

```sql
CREATE TABLE tweet_analysis (
  id SERIAL PRIMARY KEY,
  account_id INTEGER REFERENCES account_profiles(id),
  tweet_time TIMESTAMP,        -- 时间
  tweet_link TEXT,             -- 链接  
  content TEXT,                -- 内容
  content_category VARCHAR(50), -- 内容类型
  is_trending BOOLEAN,         -- 热门推文
  follower_growth INTEGER,     -- 粉丝增长
  hashtags_used TEXT[],        -- 标签使用
  engagement_metrics JSONB     -- 传播效果 (点赞/转发/评论)
);
```

#### 2.4 二维数据分析仪表板 (参考gps1.jpg)

**页面**: `/app/analytics/dashboard/page.tsx`

**分析维度**:
- **时间维度**: 周统计/月统计切换
- **发帖分析**: 数量趋势、时段分布
- **热帖分析**: 传播效果TOP榜
- **品牌曝光**: 关键词云图、提及频次
- **用户参与**: 互动率趋势、粉丝增长
- **内容策略**: 内容类型饼图、话题分析
- **社区互动**: 回复网络图、影响力传播
- **广告投放**: 推广内容识别、ROI分析

#### 2.5 AI策略分析报告

**页面**: `/app/analytics/reports/page.tsx`

**AI分析输出**:
- 运营策略总结 (GPT5/DeepSeek生成)
- 成功经验提取
- 失败案例分析
- 差异化竞争建议
- 未来运营规划建议

## 技术实现要点

### 功能1 技术方案
- **纯前端处理**: Twitter API → 数据处理 → 下载文件
- **文件下载**: 使用 `downloadjs` 库生成CSV/JSON
- **进度显示**: React状态管理 + 进度条组件
- **内存优化**: 流式处理大量数据，分批下载

### 功能2 技术方案  
- **数据库**: 仅存储分析结果，原始数据实时获取
- **AI集成**: OpenAI/DeepSeek API调用优化
- **图表组件**: Recharts/Chart.js 数据可视化
- **表格组件**: TanStack Table 高性能数据展示

### 关键组件设计
- `MediaSearchForm` - 搜索表单组件
- `ResultsDownloader` - 下载功能组件  
- `AccountInfoTable` - 账号信息表格
- `TweetAnalysisGrid` - 推文分析网格
- `AnalyticsDashboard` - 数据可视化面板
- `AIInsightsPanel` - AI分析结果展示

## 其他重要要求
1. 环境变量在.env文件中，其中包括NEXT_PUBLIC_SUPABASE_URL、NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY、DATABASE_URL、DEEPSEEK_API_KEY、NEXT_PUBLIC_SITE_URL、TWITTER_BEARER_TOKEN、OPENAI_API_KEY。
2. 前端样式要求现代简约，使用TailwindCSS + Shadcn/UI实现。
3. 项目使用supabase作为数据库，你要自动帮我push创建数据库。
4. AI就利用deepseek和openai的GPT5，你要参考最新的文档。
5. 推特api也配备的有，要参考最新的文档。