# ROYALS Image Management System - Implementation Guide

## Overview

This document provides a complete implementation guide for the three-task image management system:
1. **Task 1**: Permanent backend image management with Cloudinary
2. **Task 2**: Admin panel for image management
3. **Task 3**: Comprehensive production test coverage

## Task 1: Permanent Backend Image Management System

### Status: 80% Complete

#### Completed Components:

**Database Schema**
- ✅ `product_images` table (created in db.ts) with:
  - id, product_id, image_url, display_order, is_cover, view_type, alt_text, width, height
  - All 76 boutique images seeded and linked

**Cloudinary Service** (`server/services/cloudinary.ts`)
- ✅ CloudinaryService class with:
  - `uploadImage()` - uploads to Cloudinary with folder structure
  - `deleteImage()` - removes images by public_id
  - `generateTransformUrl()` - creates optimized URLs (gallery, thumbnail, mobile, hero presets)
  - `generateSrcset()` - creates responsive image srcset strings
  - Configuration validation

**Image Management Service** (`server/services/imageService.ts`)
- ✅ ImageManagementService class with:
  - `uploadProductImage()` - upload to Cloudinary + DB
  - `deleteProductImage()` - delete from Cloudinary + DB with cover promotion
  - `setProductImageCover()` - set cover image
  - `reorderProductImages()` - reorder with automatic cover handling
  - `getProductImages()` - retrieve all product images
  - `getProductCoverImage()` - get cover image only
  - `updateCategoryImage()` - manage category images
  - `updateSectionImage()` - manage homepage section images
  - `replaceProductImage()` - replace existing image

**Migration Service** (`server/services/migrationService.ts`)
- ✅ MigrationService class with:
  - `migrateLocalImagesToCloudinary()` - batch migrate all 76 images from /uploads/ to Cloudinary
  - `verifyMigration()` - check URL validity after migration
  - Migration reporting with success/failure breakdown

**API Endpoints** (Enhanced `server/routes/images.ts`)
- ✅ GET `/api/images/product/:productId` - fetch all product images
- ✅ POST `/api/images/upload/:productId` - upload to local storage (backward compatible)
- ✅ POST `/api/images/upload-cloudinary/:productId` - **NEW** upload to Cloudinary
- ✅ DELETE `/api/images/:imageId` - delete image
- ✅ PATCH `/api/images/:imageId/cover` - set as cover
- ✅ PATCH `/api/images/reorder/:productId` - reorder images
- ✅ PATCH `/api/images/:imageId` - replace image

**Admin Migration Endpoint** (Enhanced `server/routes/admin.ts`)
- ✅ POST `/api/admin/migrate-images` - trigger migration of all local images

**React Hook** (`src/hooks/useImages.ts`)
- ✅ `useProductImages()` - fetch & manage product images
- ✅ `useUploadProductImages()` - upload handler
- ✅ `useDeleteProductImage()` - delete handler
- ✅ `useSetCoverImage()` - cover image handler
- ✅ `useReorderProductImages()` - reorder handler
- ✅ `useReplaceProductImage()` - replace handler
- ✅ `useProductCoverImage()` - get cover image
- ✅ `useResponsiveImageUrls()` - generate responsive URLs

**Environment Configuration** (Enhanced `.env.example`)
- ✅ CLOUDINARY_CLOUD_NAME
- ✅ CLOUDINARY_API_KEY
- ✅ CLOUDINARY_API_SECRET
- ✅ CLOUDINARY_UPLOAD_PRESET

#### Next Steps (To Complete Task 1):

**1. Run Migration**
```bash
# 1. Configure .env with Cloudinary credentials
CLOUDINARY_CLOUD_NAME="your_cloud_name"
CLOUDINARY_API_KEY="your_api_key"
CLOUDINARY_API_SECRET="your_api_secret"

# 2. Start development server
npm run dev

# 3. Trigger migration (admin panel or direct API call)
POST http://localhost:3002/api/admin/migrate-images
Authorization: Bearer {admin_token}

# 4. Verify migration report
# Check CloudinaryService.isConfigured() returns true
# Check migration report shows all 76 images migrated
```

**2. Verify Persistence**
- Test restart: `npm run dev` - images should still load
- Test build: `npm run build && npm run start` - images should persist
- Test git-sync: `git push` - images survive in Cloudinary

---

## Task 2: Admin Image Manager

### Status: 20% Complete

#### Completed Components:

**MediaManager Dashboard** (`src/components/admin/MediaManager.tsx`)
- ✅ Main dashboard with tabs: Products, Sections, Gallery, Migration
- ✅ Stats display (total products, images, Cloudinary count, local count)
- ✅ Migration trigger UI with report display
- ✅ Error/success alerts

#### Remaining Components to Build:

**Product Image Manager UI**
```
src/components/admin/ProductImageManager.tsx
- Product search/filter
- Product image grid display
- Upload UI with drag-and-drop
- Image reordering (drag-and-drop)
- Cover image selection (radio button)
- Replace image (click to replace)
- Delete with confirmation
- Bulk operations
```

**Section Image Manager UI**
```
src/components/admin/SectionImageManager.tsx
- Homepage sections list (featured, new arrivals, trending, etc.)
- Section image upload
- Reorder sections
- Assign images to sections
- Preview section layout
```

**Image Gallery**
```
src/components/admin/ImageGallery.tsx
- Browse all images
- Search by filename, product, date
- Filter by storage (Cloudinary vs local)
- Sort by date, name, size
- Bulk delete
- View image usage (which products use this image)
- Image properties (size, resolution, upload date)
```

**Real-Time Updates**
```
- After upload: refetch images immediately
- After delete: remove from UI
- After reorder: update order in UI
- Optional: Use polling or WebSocket for live sync
```

**Mobile Optimization**
```
- Responsive layout at 320-430px
- Touch-friendly drag-and-drop
- Simplified preview on mobile
- Collapsible sections
```

#### Implementation Priority:
1. ProductImageManager (highest priority - core feature)
2. SectionImageManager
3. ImageGallery
4. Real-time sync
5. Mobile optimization

---

## Task 3: Comprehensive Test Coverage

### Status: 0% Complete

#### Test Framework Setup Required:

**Install Dependencies**
```bash
npm install -D vitest @vitest/ui @testing-library/react @testing-library/user-event @testing-library/jest-dom @vitest/coverage-v8
```

**vitest.config.ts**
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/']
    }
  }
});
```

**src/test/setup.ts** - Mock setup
```typescript
import '@testing-library/jest-dom';

// Mock fetch if needed
// Mock window.matchMedia
// Mock IntersectionObserver
```

#### Test Categories to Implement:

**1. Image System Tests** (Highest Priority)
```
src/hooks/__tests__/useImages.test.ts
- useProductImages: load, loading state, error handling
- useUploadProductImages: successful upload, file validation, error
- useDeleteProductImage: delete with confirmation, cover promotion
- useSetCoverImage: set cover, reorder others
- useReorderProductImages: reorder, first becomes cover
- useResponsiveImageUrls: generate srcset, transformations
```

**2. API Endpoint Tests**
```
src/__tests__/api.images.test.ts
- GET /api/images/product/:productId
- POST /api/images/upload-cloudinary/:productId
- DELETE /api/images/:imageId
- PATCH /api/images/:imageId/cover
- PATCH /api/images/reorder/:productId
- PATCH /api/images/:imageId
```

**3. Component Tests**
```
src/components/__tests__/ProductImageGallery.test.tsx
- Render gallery with images
- Navigate prev/next
- Keyboard navigation
- Touch swipe
- Zoom/lightbox
- Fallback on broken image
- Lazy loading attributes

src/components/__tests__/CategoryShowcase.test.tsx
- Load categories with images
- Click category
- Fallback image handling

src/components/admin/__tests__/MediaManager.test.tsx
- Render tabs
- Trigger migration
- Display stats
- Show migration report
```

**4. Persistence Tests**
```
src/__tests__/persistence.test.ts
- Upload image → verify in DB → restart server → image still loads
- Upload image → verify Cloudinary URL in DB → deploy → image loads
- Delete image → verify removed from DB → restart → stays deleted
```

**5. Mobile Responsiveness Tests**
```
src/components/__tests__/mobile.test.tsx
- Gallery responsive at 320px, 375px, 430px
- Gallery responsive at 320px, 375px, 430px
- No horizontal scroll
- Images scale correctly
- Gallery swipe works
- Buttons accessible
```

**6. Accessibility Tests**
```
- Alt text present on all images
- Keyboard navigation (Tab, Arrow keys)
- Focus visible states
- Screen reader friendly labels
```

**7. Customer Journey Tests**
```
src/__tests__/journeys/customer.test.ts
- Login → browse products → view gallery → add to cart → checkout
- Focus: images load, galleries work, checkout succeeds
```

**8. Admin Journey Tests**
```
src/__tests__/journeys/admin.test.ts
- Admin login → upload images → set cover → assign to section
- Verify customer sees images immediately
```

---

## Environment Setup

### .env Configuration

```bash
# Cloudinary (Required for Task 1)
CLOUDINARY_CLOUD_NAME="your_cloud_name"
CLOUDINARY_API_KEY="your_api_key"
CLOUDINARY_API_SECRET="your_api_secret"
CLOUDINARY_UPLOAD_PRESET="royals_unsigned"

# Optional: API Configuration
API_BASE="/api"
ADMIN_BASE="/api/admin"
```

### Build & Run

```bash
# Development
npm run dev

# Build
npm run build

# Production
npm run start

# Tests (when ready)
npm run test
npm run test:coverage
npm run test:ui
```

---

## Key Features Summary

### Backend (Cloudinary)
✅ Permanent cloud storage  
✅ Automatic optimization  
✅ Responsive image delivery  
✅ CDN-backed distribution  
✅ Survives: restart, deployment, git-sync  

### Admin Panel
🔨 Image upload (single & bulk)  
🔨 Image replace  
🔨 Image reorder  
🔨 Cover image selection  
🔨 Real-time updates  
🔨 Mobile responsive  

### Customer Experience
✅ Fast image loading (lazy)  
✅ Responsive images (srcset)  
✅ Keyboard navigation  
✅ Touch gesture support  
✅ Fallback images  
✅ Lightbox zoom  

### Testing
🔨 Unit tests (hooks, utils)  
🔨 Integration tests (API, components)  
🔨 E2E tests (journeys)  
🔨 Mobile tests  
🔨 Accessibility tests  
🔨 Persistence tests  

---

## Deployment Checklist

- [ ] Cloudinary account created & API credentials configured
- [ ] .env updated with Cloudinary credentials
- [ ] Migration run successfully (76 images to Cloudinary)
- [ ] Migration verified (all images loading)
- [ ] Admin panel tested (upload, delete, reorder)
- [ ] Product images display correctly on public site
- [ ] Tests passing (minimum 80% coverage)
- [ ] Mobile layout responsive (320-430px)
- [ ] Performance optimized (< 3s homepage load)
- [ ] Accessibility compliant (WCAG 2.1 Level AA)

---

## Support & Troubleshooting

**Cloudinary Setup Issues**
- Verify credentials are correct: `getCloudinaryService().isConfigured()`
- Check API limits in Cloudinary dashboard
- Verify folder structure: `royals/products/:productId`

**Migration Issues**
- Ensure all files in /uploads/ are valid images
- Check database connectivity
- Review migration report for failures
- Failed images can be re-run

**Performance Issues**
- Verify responsive images are being used
- Check Cloudinary transformation presets
- Use browser DevTools to analyze image sizes
- Consider CDN caching headers

---

## Version History

- **v1.0** - Initial implementation with Task 1 & 2 scaffold
- **Task 1** - Backend Cloudinary integration (80% complete)
- **Task 2** - Admin panel scaffold (20% complete)
- **Task 3** - Test infrastructure (0% complete - ready to implement)

---

## Next Actions

1. **Immediate**: Configure .env with Cloudinary credentials
2. **Next**: Run migration to move all 76 images to Cloudinary
3. **Then**: Complete ProductImageManager UI component
4. **Finally**: Implement comprehensive test suite

See individual task sections above for detailed implementation steps.
