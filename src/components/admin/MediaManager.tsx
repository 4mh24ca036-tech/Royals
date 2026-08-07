/**
 * Admin Media Manager Dashboard
 * Central hub for managing all product, category, and section images
 */

import React, { useState, useEffect } from 'react';
import { Upload, Trash2, AlertCircle, CheckCircle2, FileText } from 'lucide-react';
import { api } from '../../services/api';

export const MediaManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'products' | 'sections' | 'gallery' | 'migration'>('products');
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalImages: 0,
    migratedToCloudinary: 0,
    localImagesRemaining: 0
  });
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    // Load stats
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // This would fetch from a stats endpoint
      // For now, placeholder
      setStats({
        totalProducts: 0,
        totalImages: 0,
        migratedToCloudinary: 0,
        localImagesRemaining: 0
      });
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const handleMigration = async () => {
    try {
      setIsMigrating(true);
      setError(null);
      setSuccess(null);

      // Call the correct migration endpoint
      const response = await fetch('/api/admin/migrate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) throw new Error('Migration failed');
      const data = await response.json();

      setMigrationStatus(data);
      setSuccess('Image migration completed successfully!');
      await loadStats();
    } catch (err: any) {
      setError(err.message || 'Migration failed');
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F2ED]">
      {/* Header */}
      <div className="bg-white border-b border-[#E5E1D8] shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-serif italic text-[#1A1A1A]">Media Manager</h1>
          <p className="text-sm text-[#6B6658] mt-1">Manage product, category, and section images</p>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-white border-b border-[#E5E1D8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-[#C5A059]">{stats.totalProducts}</div>
              <div className="text-xs text-[#6B6658]">Products</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[#C5A059]">{stats.totalImages}</div>
              <div className="text-xs text-[#6B6658]">Total Images</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.migratedToCloudinary}</div>
              <div className="text-xs text-[#6B6658]">On Cloudinary</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600">{stats.localImagesRemaining}</div>
              <div className="text-xs text-[#6B6658]">Local Storage</div>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mx-4 mt-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 mx-4 mt-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <p className="text-sm text-green-700">{success}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border-b border-[#E5E1D8] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-8">
            {[
              { id: 'products' as const, label: 'Product Images' },
              { id: 'sections' as const, label: 'Section Images' },
              { id: 'gallery' as const, label: 'Image Gallery' },
              { id: 'migration' as const, label: 'Migration' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-1 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-[#C5A059] text-[#C5A059]'
                    : 'border-transparent text-[#6B6658] hover:text-[#1A1A1A]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'products' && (
          <div className="bg-white rounded-lg border border-[#E5E1D8] p-8 text-center">
            <Upload className="w-12 h-12 text-[#C5A059] mx-auto mb-4" />
            <h3 className="text-lg font-serif mb-2">Product Image Manager</h3>
            <p className="text-sm text-[#6B6658] mb-6">
              Upload, replace, reorder, and manage cover images for products
            </p>
            <button className="px-4 py-2 bg-[#C5A059] text-white rounded text-sm hover:bg-[#B8934F]">
              View Products
            </button>
          </div>
        )}

        {activeTab === 'sections' && (
          <div className="bg-white rounded-lg border border-[#E5E1D8] p-8 text-center">
            <Upload className="w-12 h-12 text-[#C5A059] mx-auto mb-4" />
            <h3 className="text-lg font-serif mb-2">Section Image Manager</h3>
            <p className="text-sm text-[#6B6658] mb-6">
              Manage images for homepage sections (featured, new arrivals, trending, etc.)
            </p>
            <button className="px-4 py-2 bg-[#C5A059] text-white rounded text-sm hover:bg-[#B8934F]">
              View Sections
            </button>
          </div>
        )}

        {activeTab === 'gallery' && (
          <div className="bg-white rounded-lg border border-[#E5E1D8] p-8 text-center">
            <FileText className="w-12 h-12 text-[#C5A059] mx-auto mb-4" />
            <h3 className="text-lg font-serif mb-2">Image Gallery</h3>
            <p className="text-sm text-[#6B6658] mb-6">
              Browse and search all images across products and sections
            </p>
            <button className="px-4 py-2 bg-[#C5A059] text-white rounded text-sm hover:bg-[#B8934F]">
              Browse Gallery
            </button>
          </div>
        )}

        {activeTab === 'migration' && (
          <div className="space-y-6">
            {/* Migration Info Card */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-blue-900 mb-3">Cloudinary Migration</h3>
              <p className="text-sm text-blue-800 mb-4">
                Migrate all existing local images from /uploads/ to Cloudinary for permanent, optimized storage. 
                Images will survive restarts, deployments, and git-sync operations.
              </p>
              <button
                onClick={handleMigration}
                disabled={isMigrating}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 text-sm font-medium"
              >
                {isMigrating ? 'Migrating...' : 'Start Migration'}
              </button>
            </div>

            {/* Migration Report */}
            {migrationStatus && (
              <div className="bg-white border border-[#E5E1D8] rounded-lg p-6">
                <h4 className="font-semibold mb-4">Migration Report</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#C5A059]">{migrationStatus.report.totalImages}</div>
                    <div className="text-xs text-[#6B6658]">Total Found</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{migrationStatus.report.migratedCount}</div>
                    <div className="text-xs text-[#6B6658]">Migrated</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-amber-600">{migrationStatus.report.skippedCount}</div>
                    <div className="text-xs text-[#6B6658]">Skipped</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{migrationStatus.report.failedCount}</div>
                    <div className="text-xs text-[#6B6658]">Failed</div>
                  </div>
                </div>
                <p className="text-xs text-[#6B6658]">
                  Completed in {(migrationStatus.report.duration / 1000).toFixed(2)}s
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaManager;
