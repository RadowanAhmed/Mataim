import React, { createContext, useContext, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from './supabase';

interface Post {
  id: string;
  restaurant_id: string;
  title: string;
  description: string;
  image_url: string;
  post_type: 'food' | 'promotion' | 'announcement' | 'event';
  discount_percentage: number;
  original_price: number;
  discounted_price: number;
  available_until: string;
  is_active: boolean;
  likes_count: number;
  comments_count: number;
  view_count: number;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface PostsContextType {
  posts: Post[];
  loading: boolean;
  fetchPosts: (restaurantId: string) => Promise<void>;
  createPost: (postData: Partial<Post>) => Promise<{ success: boolean; error?: string }>;
  updatePost: (postId: string, updates: Partial<Post>) => Promise<{ success: boolean; error?: string }>;
  deletePost: (postId: string) => Promise<{ success: boolean; error?: string }>;
  togglePostStatus: (postId: string, currentStatus: boolean) => Promise<{ success: boolean; error?: string }>;
}

const PostsContext = createContext<PostsContextType>({} as PostsContextType);

export const PostsProvider = ({ children }: { children: React.ReactNode }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPosts = async (restaurantId: string) => {
    if (!restaurantId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error fetching posts:', error);
      Alert.alert('Error', 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const createPost = async (postData: Partial<Post>) => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .insert([postData])
        .select()
        .single();

      if (error) throw error;
      
      setPosts(prev => [data, ...prev]);
      return { success: true };
    } catch (error: any) {
      console.error('Error creating post:', error);
      return { success: false, error: error.message };
    }
  };

  const updatePost = async (postId: string, updates: Partial<Post>) => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .update(updates)
        .eq('id', postId)
        .select()
        .single();

      if (error) throw error;
      
      setPosts(prev => prev.map(post => 
        post.id === postId ? { ...post, ...data } : post
      ));
      return { success: true };
    } catch (error: any) {
      console.error('Error updating post:', error);
      return { success: false, error: error.message };
    }
  };

  const deletePost = async (postId: string) => {
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;
      
      setPosts(prev => prev.filter(post => post.id !== postId));
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting post:', error);
      return { success: false, error: error.message };
    }
  };

  const togglePostStatus = async (postId: string, currentStatus: boolean) => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .update({ is_active: !currentStatus })
        .eq('id', postId)
        .select()
        .single();

      if (error) throw error;
      
      setPosts(prev => prev.map(post => 
        post.id === postId ? { ...post, ...data } : post
      ));
      return { success: true };
    } catch (error: any) {
      console.error('Error toggling post status:', error);
      return { success: false, error: error.message };
    }
  };

  return (
    <PostsContext.Provider
      value={{
        posts,
        loading,
        fetchPosts,
        createPost,
        updatePost,
        deletePost,
        togglePostStatus,
      }}
    >
      {children}
    </PostsContext.Provider>
  );
};

export const usePosts = () => {
  const context = useContext(PostsContext);
  if (!context) {
    throw new Error('usePosts must be used within a PostsProvider');
  }
  return context;
};