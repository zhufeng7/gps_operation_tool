"use client";

import { useState } from 'react';
import Image from 'next/image';
import { ExternalLinkIcon, ImageIcon, AlertCircleIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TweetImageProps {
  src: string;
  alt: string;
  tweetUrl: string;
  index: number;
  width?: number;
  height?: number;
}

export function TweetImage({ 
  src, 
  alt, 
  tweetUrl, 
  index, 
  width = 400, 
  height = 192 
}: TweetImageProps) {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const handleImageError = () => {
    console.warn(`图片加载失败: ${src}`);
    setImageError(true);
    setIsLoading(false);
  };

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  // 生成一致的占位符图片 - 使用与原逻辑相同的参数
  const fallbackSrc = `https://picsum.photos/400/300?random=${index}`;
  
  return (
    <div className="relative mb-3 rounded-lg overflow-hidden bg-muted">
      {imageError ? (
        // 错误状态显示
        <div className="w-full h-48 bg-muted flex flex-col items-center justify-center text-muted-foreground">
          <AlertCircleIcon className="h-8 w-8 mb-2" />
          <p className="text-sm text-center">图片加载失败</p>
          <p className="text-xs text-center mt-1">点击查看原推文</p>
        </div>
      ) : (
        <>
          {isLoading && (
            <div className="absolute inset-0 bg-muted animate-pulse flex items-center justify-center">
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
          <Image
            src={imageError ? fallbackSrc : src}
            alt={alt}
            width={width}
            height={height}
            className="w-full h-48 object-cover"
            onError={handleImageError}
            onLoad={handleImageLoad}
            placeholder="blur"
            blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R6i8opXsUOjGFNcA5kAAO4uAmPmFKnjFRgzrUBKMkwEa5Cp33TT6dV9L2QZX0ZXvLhRb7tU="
          />
        </>
      )}
      
      {/* 推文编号 */}
      <Badge className="absolute top-2 right-2 bg-black/50 text-white border-0">
        #{index + 1}
      </Badge>
      
      {/* 查看原推文按钮 */}
      <div className="absolute top-2 left-2">
        <a
          href={tweetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center w-8 h-8 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
          title="查看原推文"
        >
          <ExternalLinkIcon className="h-4 w-4 text-white" />
        </a>
      </div>
      
      {/* 加载失败时的重试按钮 */}
      {imageError && (
        <div className="absolute bottom-2 right-2">
          <button
            onClick={() => {
              setImageError(false);
              setIsLoading(true);
            }}
            className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded hover:bg-primary/90 transition-colors"
            title="重试加载"
          >
            重试
          </button>
        </div>
      )}
    </div>
  );
}