# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个基于 Next.js 15 + Supabase 的GPS运营工具全栈应用程序，使用 App Router 架构，集成了Twitter API、OpenAI API和完整的身份验证系统。主要功能包括Twitter数据收集与分析、AI内容分析和时间序列分析。

## 开发命令

### 基础命令
```bash
npm run dev          # 启动开发服务器 (使用 Turbopack)
npm run build        # 构建生产版本
npm run start        # 启动生产服务器
npm run lint         # 运行 ESLint 代码检查
```

### 开发调试
- 开发服务器默认运行在 `http://localhost:3000`
- 使用 Turbopack 进行快速热重载
- 生产构建前务必运行 lint 检查

## 项目架构

### Supabase 集成架构
项目采用三层 Supabase 客户端模式，支持全栈身份验证：

1. **Browser Client** (`lib/supabase/client.ts`) - 客户端组件使用
2. **Server Client** (`lib/supabase/server.ts`) - 服务器组件和 API 路由使用  
3. **Middleware Client** (`lib/supabase/middleware.ts`) - 中间件路由保护使用

### 身份验证流程
- 基于 Cookie 的会话管理，支持 SSR/SSG
- 中间件自动处理路由保护，未认证用户重定向到 `/auth/login`
- 完整的认证页面：登录、注册、忘记密码、更新密码
- 认证状态在整个 Next.js 应用中可用（客户端/服务器组件、路由处理器、服务器操作）

### 关键文件结构
```
app/
  ├── auth/           # 认证相关页面
  └── protected/      # 受保护的页面
components/
  ├── auth-*.tsx      # 认证相关组件
  ├── tutorial/       # 教程组件
  └── ui/            # shadcn/ui 组件
lib/
  └── supabase/      # Supabase 客户端配置
middleware.ts        # 路由保护中间件
```

## 环境配置

### 必需的环境变量
```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY=your-anon-key
TWITTER_BEARER_TOKEN=your-twitter-bearer-token  # Twitter API Bearer Token
OPENAI_API_KEY=your-openai-api-key  # OpenAI API Key (通过代码推断需要)
```

### 重要提醒
- 环境变量名称在 `.env.example` 和实际代码中可能不一致
- 检查 `lib/supabase/*.ts` 文件中使用的具体变量名
- `lib/utils.ts` 中的 `hasEnvVars` 函数用于检查环境变量是否设置

## UI 框架

### 技术栈
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui + Radix UI
- **Icons**: Lucide React
- **Theme**: next-themes (支持深色模式)

### 组件开发
- 使用 `cn()` 工具函数合并 CSS 类 (clsx + tailwind-merge)
- 遵循 shadcn/ui 组件模式和变体系统
- 支持深色模式切换

## 开发注意事项

### Supabase 客户端使用
- **服务器端**: 总是在函数内创建新的 `createClient()` 实例，避免全局变量
- **中间件**: 必须返回 `supabaseResponse` 对象以保持会话同步
- **认证状态**: 使用 `supabase.auth.getClaims()` 获取用户信息

### 路由保护
- 中间件自动保护除 `/`、`/auth/*` 外的所有路由
- 受保护页面放在 `app/protected/` 目录下
- 修改路由保护逻辑需同时更新 `middleware.ts` 配置

### 开发工具
- TypeScript 配置完整，包含严格类型检查
- ESLint 配置使用 Next.js 推荐规则
- 支持 PostCSS 和 Autoprefixer

## 应用功能模块

### Twitter 数据收集与分析
- **API路由**: `/api/twitter/*` - Twitter数据收集相关接口
- **核心服务**: `lib/services/twitter-api-v2.ts` - Twitter API v2 客户端
- **功能页面**: `/media-search` - 媒体搜索功能
- **数据库**: 完整的Twitter用户和推文数据模型 (见 `database-schema.sql`)

### AI 内容分析
- **API路由**: `/api/ai/*` - AI分析相关接口，包括：
  - `/api/ai/rewrite-tweet` - 推文重写
  - `/api/ai/analyze-style` - 风格分析
  - `/api/ai/content-classification` - 内容分类
  - `/api/ai/keyword-trends` - 关键词趋势分析
- **功能页面**: `/ai/tweet-rewriter` - 推文重写工具

### 数据分析与可视化
- **时间序列分析**: `/analytics/time-analysis-v2` 和 `/analytics/time-analysis-v3`
- **数据库服务**: `lib/services/database-service.ts` - 数据库操作服务
- **缓存系统**: `lib/cache-v2.ts` - 缓存管理

### 数据库架构
- **Twitter用户表**: 存储Twitter用户基本信息、统计数据
- **推文表**: 存储推文内容、互动数据、媒体信息
- **关系设计**: 用户与推文的外键关联，支持级联删除
- **JSON字段**: 媒体数据、实体标注、上下文注释等结构化存储

## 技术架构要点

### API 设计模式
- 统一的错误处理和响应格式
- 基于路由文件夹的RESTful API设计
- 集成第三方API（Twitter、OpenAI）的代理层

### 服务层设计
- `lib/services/` 目录下的服务类负责业务逻辑
- Twitter API封装：处理认证、限流、数据转换
- 数据库服务：提供数据访问抽象层

### 缓存策略
- 实现了v2版本的缓存系统
- 支持数据缓存和API响应缓存
- 优化高频数据访问性能