# Implementation Plan: Permanent Backend Image Management System

## Overview

This implementation plan converts the design specification into discrete, incremental coding tasks. The system establishes a three-layer architecture: cloud storage (Cloudinary), persistent database layer (SQLite), and REST API layer (Express) with React integration. Tasks follow a dependency-based sequence: database schema first, then services, then API endpoints, then React components, and finally the migration execution. Each task includes property-based tests where correctness properties are applicable, with optional test sub-tasks marked with `*`.

## Tasks

- [ ] 1. Database Schema Setup and Migrations
  - [ ] 1.1 Create migration script for categories and editorial_strips extensions
    - Add `image_url` TEXT columns to existing tables
    - Verify safe migration that preserves existing data
    - _Requirements: 1.1, 1.2_
  
  - [ ] 1.2 Create product_images table with schema
    - Define all columns: id, product_id, image_url, display_order, is_cover, alt_text, width, height, created_at, updated_at
    - Create indexes on product_id and is_cover for query performance
    - _Requirements: 1.3_
  
  - [ ] 1.3 Create homepage_sections table with schema
    - Define all columns: id, name, section_key, description, image_urls_json, display_order, is_active, created_at, updated_at
    - Create indexes on section_key and is_active
    - _Requirements: 1.4_
  
  - [ ]* 1.4 Write property tests for schema correctness
    - **Property 13: Database Round-Trip Invariant** - Verify data round-trip integrity through schema
    - **Validates: Requirements 5.1, 5.3, 5.4, 8.1**

- [ ] 2. Cloudinary Service Implementation
  - [ ] 2.1 Create CloudinaryService class
    - Initialize Cloudinary SDK with environment credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)
    - Add error handling and logging for missing credentials
    - _Requirements: 2.1, 2.2_
  
  - [ ] 2.2 Implement uploadImage() method
    - Accept File object, folder and publicId options
    - Call Cloudinary upload API
    - Extract and return: cloudinaryUrl, publicId, width, height, format
    - _Requirements: 2.3_
  
  - [ ] 2.3 Implement deleteImage() method
    - Accept publicId parameter
    - Call Cloudinary delete API
    - Return boolean success status
    - _Requirements: 2.4_
  
  - [ ] 2.4 Implement generateTransformUrl() method
    - Accept base URL, preset (gallery/thumbnail/mobile/hero), density (1x/2x)
    - Apply Cloudinary transformation parameters: width, quality=auto, fetch-format=auto
    - Return transformed Cloudinary URL
    - _Requirements: 2.5, 2.6, 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [ ]* 2.5 Write property tests for transformation correctness
    - **Property 4: Transformation URL Correctness** - Verify all presets apply correct parameters
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.8**

- [ ] 3. Image Management Service
  - [ ] 3.1 Create ImageService class
    - Accept database connection and CloudinaryService in constructor
    - Add error handling for file validation: max 10MB, supported formats (jpeg, png, webp, gif)
    - _Requirements: 10.4, 10.5_
  
  - [ ] 3.2 Implement uploadProductImages() method
    - Accept productId, file array, userId
    - Validate files and product existence
    - Upload to Cloudinary with public_id format: `royals/{context}/{uuid}`
    - Insert records into product_images table with all metadata
    - Persist database changes
    - Return array of ProductImage objects
    - _Requirements: 3.1, 5.1, 11.1_
  
  - [ ] 3.3 Implement uploadCategoryImage() method
    - Accept categoryId, file, userId
    - Upload to Cloudinary
    - Update categories.image_url with new URL
    - Extract and store width, height
    - Persist database changes
    - _Requirements: 3.1, 5.1, 11.1_
  
  - [ ] 3.4 Implement uploadSectionImages() method
    - Accept sectionKey, file array, userId
    - Validate section exists and image count does not exceed 20
    - Upload each file to Cloudinary
    - Insert or update homepage_sections with image URLs as JSON array
    - Persist database changes
    - Return HomepageSection object
    - _Requirements: 3.1, 5.1, 12.2, 12.5_
  
  - [ ] 3.5 Implement deleteImage() method
    - Accept imageId and table parameter (product_images|categories|editorial_strips)
    - Retrieve image from database to get publicId/URL
    - Delete from Cloudinary using publicId
    - Delete from database
    - Persist database changes
    - _Requirements: 3.3, 5.5_
  
  - [ ] 3.6 Implement setImageCover() method
    - Accept imageId (product_images table)
    - Find product_id for this image
    - Update is_cover=1 for imageId
    - Update is_cover=0 for all other images in same product
    - Persist database changes
    - _Requirements: 3.5_
  
  - [ ] 3.7 Implement reorderImages() method
    - Accept section (product|section), targetId, array of { imageId, displayOrder }
    - Update display_order for each image in appropriate table
    - Persist database changes
    - _Requirements: 3.4_
  
  - [ ] 3.8 Implement replaceImage() method
    - Accept imageId, newFile, table parameter
    - Retrieve old image metadata to get publicId
    - Delete old image from Cloudinary
    - Upload new file to Cloudinary
    - Update URL and metadata in database
    - Persist database changes
    - _Requirements: 3.2_
  
  - [ ]* 3.9 Write property tests for image management
    - **Property 1: Image Upload Persistence** - Verify uploaded images persist in database across restarts
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 5.1, 5.2, 5.4, 8.1, 8.2**
  
  - [ ]* 3.10 Write property tests for cover image uniqueness
    - **Property 2: Cover Image Uniqueness** - Verify exactly one cover image per product after setImageCover()
    - **Validates: Requirements 3.5**

- [ ] 4. Migration Service Implementation
  - [ ] 4.1 Create MigrationService class
    - Accept database connection and CloudinaryService in constructor
    - Implement method to read all files from /uploads/prod_boutique_XX/ (XX: 01-76)
    - _Requirements: 4.1_
  
  - [ ] 4.2 Implement migrateExistingImages() method
    - Iterate over 76 files in /uploads/prod_boutique_XX/
    - Extract product_id from filename pattern
    - Upload each file to Cloudinary with public_id: `royals/boutique/{original_filename}`
    - Store Cloudinary URL in product_images table
    - Extract width/height from Cloudinary response
    - On error: log failure with filename/product_id, continue processing
    - _Requirements: 4.2, 4.3, 4.4_
  
  - [ ] 4.3 Implement idempotence check
    - Before uploading, query database for existing Cloudinary URL with same public_id
    - Skip upload if already migrated
    - Return report noting skipped images
    - _Requirements: 4.6_
  
  - [ ] 4.4 Implement migration report generation
    - Track: totalAttempted, successCount, failureCount, failed array with reason
    - Include timestamp and duration (milliseconds)
    - Return MigrationReport object
    - _Requirements: 4.5_
  
  - [ ]* 4.5 Write property tests for migration idempotence
    - **Property 5: Migration Idempotence** - Verify multiple migration runs produce same final state with no duplicates
    - **Validates: Requirements 4.6**

- [ ] 5. Admin API Endpoints
  - [ ] 5.1 Create POST /api/images/upload endpoint
    - Accept multipart/form-data with files, target_type, product_id|category_id|sectionKey, alt_text (optional)
    - Validate JWT token with super_admin role for admin operations (optional for public endpoints - adjust as needed per requirements)
    - Call ImageService.uploadProductImages/uploadCategoryImage/uploadSectionImages based on target_type
    - Return 200 with image array or appropriate error status codes
    - _Requirements: 3.1, 10.2, 10.4, 10.5, 11.2_
  
  - [ ] 5.2 Create PATCH /api/images/{imageId} endpoint
    - Accept multipart/form-data with file, alt_text (optional)
    - Call ImageService.replaceImage()
    - Return updated image object
    - _Requirements: 3.2, 10.4, 10.5_
  
  - [ ] 5.3 Create DELETE /api/images/{imageId} endpoint
    - Call ImageService.deleteImage()
    - Return 200 with { success: true } or 404 if not found
    - _Requirements: 3.3, 10.2_
  
  - [ ] 5.4 Create PATCH /api/images/{imageId}/cover endpoint
    - Call ImageService.setImageCover()
    - Return updated image object with is_cover: 1
    - _Requirements: 3.5_
  
  - [ ] 5.5 Create PATCH /api/images/reorder/{section} endpoint
    - Accept JSON body: { order: [ { imageId, displayOrder }, ... ] }
    - Call ImageService.reorderImages()
    - Return array of reordered images
    - _Requirements: 3.4_
  
  - [ ] 5.6 Create POST /api/images/migrate endpoint
    - Validate JWT token with super_admin role
    - Call MigrationService.migrateExistingImages()
    - Return migration report
    - Log all migration attempts (success/failure) with admin username and timestamp
    - _Requirements: 4.1, 4.2, 9.1, 9.2, 9.3, 9.4_
  
  - [ ]* 5.7 Write property tests for admin authorization
    - **Property 6: Authorization Validation** - Verify super_admin role required for migration endpoint
    - **Validates: Requirements 9.1, 9.2, 9.3**

- [ ] 6. Public API Endpoints
  - [ ] 6.1 Create GET /api/images/product/{productId} endpoint
    - Query product_images table where product_id matches
    - Order by display_order
    - Return { images: [ { id, image_url, width, height, alt_text, display_order, is_cover }, ... ] }
    - _Requirements: 3.7, 5.3, 11.1_
  
  - [ ] 6.2 Create GET /api/images/category/{categoryId} endpoint
    - Query categories table for image_url
    - Return { image_url, width, height, alt_text }
    - Return 404 if category not found or no image
    - _Requirements: 3.8, 5.3, 11.1_
  
  - [ ] 6.3 Create GET /api/images/section/{sectionKey} endpoint
    - Query homepage_sections where section_key matches and is_active=1
    - Parse image_urls_json and return images ordered by display_order
    - Return array of images with full metadata
    - Return 404 if section not found
    - _Requirements: 3.6, 3.9, 5.3, 12.1, 12.3_
  
  - [ ] 6.4 Create GET /api/images/editorial endpoint
    - Query editorial_strips where image_url is not null, ordered by display_order
    - Return array of editorial objects with image_url, alt_text, width, height
    - _Requirements: 3.9, 5.3_
  
  - [ ]* 6.5 Write property tests for section key resolution
    - **Property 11: Section-Key Resolution** - Verify queries return images only for correct sectionKey
    - **Validates: Requirements 3.6, 12.1, 12.3**

- [ ] 7. React useImages Hook
  - [ ] 7.1 Create src/hooks/useImages.ts
    - Export function: useImages(type: 'product'|'category'|'section'|'editorial', targetId: string)
    - Return object: { images: Image[], isLoading: boolean, error: string|null, refetch: () => Promise<void> }
    - On mount: call appropriate GET endpoint based on type parameter
    - On error: set error message, provide refetch function
    - Implement refetch: clear error, set loading, retry endpoint
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [ ]* 7.2 Write unit tests for useImages hook
    - Test successful fetch scenarios for each type (product, category, section, editorial)
    - Test error handling and refetch function
    - _Requirements: 6.2, 6.3_

- [ ] 8. Update ProductImageGallery Component
  - [ ] 8.1 Refactor ProductImageGallery to use useImages hook
    - Remove image props from component signature
    - Call useImages('product', productId)
    - Display cover image (is_cover=1) as primary
    - Render remaining images as thumbnails below
    - Add loading state while images fetch
    - Add error state with fallback placeholder (/images/placeholder.jpg)
    - _Requirements: 6.4, 6.7_
  
  - [ ] 8.2 Implement lazy loading and responsive images
    - Add loading="lazy" and decoding="async" attributes to all img elements
    - Generate srcset with 1x and 2x density variations using Cloudinary transformations
    - Apply object-fit: cover CSS to gallery images
    - _Requirements: 6.8, 7.6, 7.7_
  
  - [ ] 8.3 Integrate responsive sizing
    - Detect viewport width and select appropriate preset (mobile/gallery/hero)
    - Generate transformation URLs using CloudinaryService.generateTransformUrl()
    - Update srcset URLs based on viewport
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [ ]* 8.4 Write unit tests for ProductImageGallery
    - Test useImages hook integration
    - Test cover image as primary display
    - Test lazy loading attributes
    - _Requirements: 6.4, 6.8_

- [ ] 9. Update EditorialStrip Component
  - [ ] 9.1 Refactor EditorialStrip to use useImages hook
    - Call useImages('section', 'editorial')
    - Display images in carousel or grid based on design
    - Order by display_order
    - Add loading and error states
    - _Requirements: 6.5, 6.7_
  
  - [ ] 9.2 Apply hero image transformations
    - Generate Cloudinary transformation URLs with hero preset (1920px)
    - Apply quality=auto and fetch-format=auto
    - _Requirements: 7.4_
  
  - [ ] 9.3 Implement lazy loading
    - Add loading="lazy" attribute to all images
    - Apply responsive srcset with 1x and 2x variants
    - _Requirements: 6.8, 7.7_
  
  - [ ]* 9.4 Write unit tests for EditorialStrip
    - Test useImages hook integration
    - Test hero transformation application
    - _Requirements: 6.5_

- [ ] 10. Update CategoryShowcase Component
  - [ ] 10.1 Refactor CategoryShowcase to use useImages hook
    - Call useImages('category', categoryId)
    - Fetch and display single category image
    - Add loading and error states
    - Apply fallback placeholder if no image
    - _Requirements: 6.6, 6.7_
  
  - [ ] 10.2 Implement responsive sizing
    - Apply appropriate Cloudinary transformation preset based on component context
    - Generate responsive srcset
    - _Requirements: 7.1, 7.2, 7.6, 7.7_
  
  - [ ]* 10.3 Write unit tests for CategoryShowcase
    - Test useImages hook integration
    - Test image display and fallback
    - _Requirements: 6.6_

- [ ] 11. Update Homepage Components
  - [ ] 11.1 Update Featured Collections section
    - Call useImages('section', 'featured-collections')
    - Render images from returned array
    - Order by display_order
    - Apply responsive transformations
    - _Requirements: 12.1, 12.3_
  
  - [ ] 11.2 Update New Arrivals section
    - Call useImages('section', 'new-arrivals')
    - Render images with responsive sizing and lazy loading
    - _Requirements: 12.1, 12.3_
  
  - [ ] 11.3 Update Best Sellers section
    - Call useImages('section', 'best-sellers')
    - Render images with responsive sizing and lazy loading
    - _Requirements: 12.1, 12.3_
  
  - [ ] 11.4 Update Trending section
    - Call useImages('section', 'trending')
    - Render images with responsive sizing and lazy loading
    - _Requirements: 12.1, 12.3_
  
  - [ ]* 11.5 Write integration tests for homepage sections
    - Test each section loads correct images for its sectionKey
    - Test image ordering by display_order
    - _Requirements: 12.1, 12.3_

- [ ] 12. Environment and Startup Configuration
  - [ ] 12.1 Create .env.example with Cloudinary variables
    - Add: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, DATABASE_PATH
    - Add documentation comments for each variable
    - _Requirements: 2.1, 2.2_
  
  - [ ] 12.2 Implement environment validation on startup
    - Check for required Cloudinary credentials
    - Check for DATABASE_PATH
    - Log error and exit if any missing
    - Verify DATABASE_PATH is writable
    - _Requirements: 2.2_
  
  - [ ]* 12.3 Write validation tests
    - Test startup fails with missing CLOUDINARY_CLOUD_NAME
    - Test startup fails with missing CLOUDINARY_API_KEY
    - _Requirements: 2.2_

- [ ] 13. Checkpoint - Ensure all tests pass
  - Ensure all unit and property tests pass, ensure no TypeScript compilation errors, ask the user if questions arise.

- [ ] 14. Image Persistence and Deletion Testing
  - [ ] 14.1 Write integration tests for image upload persistence
    - Upload image via POST /api/images/upload
    - Verify image appears in database
    - Restart application
    - Verify image still available via GET endpoint (loaded from persistent database)
    - _Requirements: 5.1, 5.2, 8.1, 8.2_
  
  - [ ]* 14.2 Write property tests for deletion completeness
    - **Property 3: Image Deletion Completeness** - Verify deleted images removed from Cloudinary and database
    - **Validates: Requirements 3.3, 5.5**
  
  - [ ]* 14.3 Write property tests for metadata integrity
    - **Property 8: Metadata Capture and Retrieval** - Verify width, height, alt_text, display_order persisted correctly
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.4**
  
  - [ ]* 14.4 Write property tests for section image limits
    - **Property 9: Section Image Limit Enforcement** - Verify 20-image limit enforced, HTTP 409 returned on excess
    - **Validates: Requirements 12.5**
  
  - [ ]* 14.5 Write property tests for image reordering
    - **Property 10: Image Reordering Completeness** - Verify display_order updates and GET returns correct order
    - **Validates: Requirements 3.4_

- [ ] 15. Responsive Image Delivery Testing
  - [ ]* 15.1 Write property tests for responsive image delivery
    - **Property 12: Responsive Image Delivery** - Verify mobile viewport gets 600px, desktop gets 1200px from srcset
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.7**

- [ ] 16. Accessibility and Alt Text Testing
  - [ ]* 16.1 Write property tests for alt text presence
    - **Property 15: Alt Text Accessibility** - Verify alt_text present in all responses and rendered in HTML
    - **Validates: Requirements 6.1, 11.2, 11.3, 11.4**

- [ ] 17. Checkpoint - Ensure all tests pass
  - Ensure all integration and property tests pass, verify TypeScript build succeeds, ask the user if questions arise.

- [ ] 18. Migration Execution
  - [ ] 18.1 Call POST /api/images/migrate endpoint with admin authorization
    - Verify endpoint accepts admin JWT token
    - Verify migration report generated
    - _Requirements: 4.1, 4.5_
  
  - [ ] 18.2 Verify all 76 images uploaded to Cloudinary
    - Check migration report: successCount should equal or exceed 76 (or account for pre-existing)
    - Verify failureCount is 0 (or acceptable failures)
    - _Requirements: 4.2, 4.3_
  
  - [ ] 18.3 Verify database updated with Cloudinary URLs
    - Query product_images table
    - Verify 76 records have valid Cloudinary URLs (starting with https://res.cloudinary.com/)
    - Verify width and height populated
    - _Requirements: 5.1, 5.3, 11.1_
  
  - [ ] 18.4 Verify images display correctly on homepage and product pages
    - Navigate to homepage, inspect featured collections, new arrivals, best sellers, trending sections
    - Verify images load from Cloudinary URLs (not /uploads/)
    - Navigate to product pages, verify product image galleries display
    - _Requirements: 8.1, 8.2, 6.4_
  
  - [ ] 18.5 Verify application restart preserves images
    - Stop application
    - Restart application
    - Verify all images still load from database-persisted URLs
    - _Requirements: 5.2, 8.2, 8.3, 8.4_

- [ ] 19. Final Checkpoint - All features complete
  - Ensure all tests pass, all endpoints functional, images persist across restart, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based and unit tests that can be skipped for faster MVP, but are recommended for confidence in correctness properties
- Each task references specific requirements for traceability
- Checkpoints (tasks 13, 17, 19) ensure incremental validation of critical properties
- Property tests validate universal correctness properties defined in the design document
- Core implementation tasks (non-test tasks) should all be completed
- Migration execution (task 18) should run last after all infrastructure is in place
- All timestamps in database records should use ISO 8601 format (e.g., 2024-01-15T10:30:00Z)
- Error logging should include: filename, product_id/target_id, timestamp, and full Cloudinary API response
- Database persistence must call persistDb() after any write operation to ensure changes are committed to disk

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["1.4", "2.1", "2.2", "2.3", "2.4"] },
    { "id": 2, "tasks": ["2.5", "3.1", "3.2", "3.3", "3.4"] },
    { "id": 3, "tasks": ["3.5", "3.6", "3.7", "3.8", "3.9", "3.10"] },
    { "id": 4, "tasks": ["4.1", "4.2", "4.3", "4.4"] },
    { "id": 5, "tasks": ["4.5", "5.1", "5.2", "5.3", "5.4", "5.5", "5.6"] },
    { "id": 6, "tasks": ["5.7", "6.1", "6.2", "6.3", "6.4"] },
    { "id": 7, "tasks": ["6.5", "7.1", "7.2", "8.1", "8.2", "8.3"] },
    { "id": 8, "tasks": ["8.4", "9.1", "9.2", "9.3", "9.4"] },
    { "id": 9, "tasks": ["10.1", "10.2", "10.3", "11.1", "11.2", "11.3", "11.4"] },
    { "id": 10, "tasks": ["11.5", "12.1", "12.2"] },
    { "id": 11, "tasks": ["12.3", "14.1", "14.2", "14.3", "14.4", "14.5"] },
    { "id": 12, "tasks": ["15.1", "16.1"] }
  ]
}
```

