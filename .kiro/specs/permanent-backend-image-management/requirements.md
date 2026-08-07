# Requirements Document: Permanent Backend Image Management System

## Introduction

The Royals boutique e-commerce platform currently stores images in local file uploads (`/uploads/prod_boutique_XX/`) which are ephemeral and lost after deployments, git syncs, or restarts. This feature implements a permanent, cloud-based image management system using Cloudinary to ensure all product images, category images, editorial content, and homepage sections remain accessible across all operational scenarios. The system will migrate 76 existing images to Cloudinary, establish database persistence for image URLs, and provide a unified image management API with optimization features (responsive sizing, compression, transformations).

## Glossary

- **Cloudinary**: Third-party cloud image management service providing upload, storage, transformation, and delivery of images via CDN
- **Image URL**: Direct HTTPS link to an image hosted on Cloudinary that persists indefinitely
- **Database**: SQLite database (royals.sqlite) that persists image URLs and metadata for products, categories, and homepage sections
- **System**: The Royals backend server (Node.js/Express) and associated database
- **Product Images**: Collection of images associated with a single product (gallery, cover, thumbnail views)
- **Cover/Primary Image**: The main image displayed in product listings and previews
- **Section**: Logical grouping of images (e.g., featured-collections, new-arrivals, best-sellers, trending)
- **Migration**: One-time process of uploading 76 existing images from local `/uploads/prod_boutique_XX/` to Cloudinary and updating database URLs
- **Admin User**: User with super_admin role authorized to perform migrations and manage images
- **Image Transformation**: Server-side image modification (resizing, compression, quality adjustment) via Cloudinary

## Requirements

### Requirement 1: Database Schema Extensions for Image Persistence

**User Story:** As a system admin, I want the database to permanently store image URLs and metadata so that images remain accessible after deployments and system restarts.

#### Acceptance Criteria

1. THE System SHALL add an `image_url` field (TEXT, nullable) to the `categories` table to store the primary category image URL
2. THE System SHALL add an `image_url` field (TEXT, nullable) to the `editorial_strips` table if not already present
3. THE System SHALL ensure the `product_images` table has columns: `id` (TEXT, PRIMARY KEY), `product_id` (TEXT), `image_url` (TEXT, NOT NULL), `display_order` (INTEGER, DEFAULT 0), `is_cover` (INTEGER, DEFAULT 0), `alt_text` (TEXT), `width` (INTEGER), `height` (INTEGER), `created_at` (TEXT), `updated_at` (TEXT)
4. THE System SHALL create a new `homepage_sections` table with columns: `id` (TEXT, PRIMARY KEY), `name` (TEXT), `section_key` (TEXT, UNIQUE), `description` (TEXT), `image_urls_json` (TEXT), `display_order` (INTEGER, DEFAULT 0), `is_active` (INTEGER, DEFAULT 1), `created_at` (TEXT), `updated_at` (TEXT)
5. WHEN the database is initialized, THE System SHALL execute migration scripts that safely add missing columns without dropping or modifying existing data

### Requirement 2: Cloudinary Service Integration

**User Story:** As a developer, I want a backend service that manages all image operations through Cloudinary so that images are optimized and persistently stored in the cloud.

#### Acceptance Criteria

1. THE System SHALL read Cloudinary credentials (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`) from environment variables in `.env`
2. THE System SHALL initialize a Cloudinary SDK client on application startup with error handling if credentials are missing
3. WHEN an image is uploaded, THE System SHALL call Cloudinary's upload API and receive a unique Cloudinary URL in response
4. WHEN an image is deleted, THE System SHALL call Cloudinary's delete API using the public_id to remove it from Cloudinary storage
5. THE System SHALL implement image transformation presets for: `gallery` (1200px width), `thumbnail` (400px width), `mobile` (600px width), `hero` (1920px width)
6. WHEN a transformation is requested, THE System SHALL apply auto quality (quality: 'auto'), auto compression, and WebP format negotiation to optimize file size

### Requirement 3: Image Upload and Management API Endpoints

**User Story:** As an admin, I want REST API endpoints to upload, delete, replace, reorder, and set cover images so that I can manage product imagery programmatically.

#### Acceptance Criteria

1. WHEN a POST request arrives at `/api/images/upload`, THE System SHALL accept single or multiple image files (multipart/form-data), upload each to Cloudinary, store image URLs in the appropriate database table based on `target_type` (product/category/editorial), and return an array of image objects with `id`, `image_url`, and metadata
2. WHEN a PATCH request arrives at `/api/images/{imageId}`, THE System SHALL delete the old image from Cloudinary, upload the new image, update the URL in the database, and return the updated image object
3. WHEN a DELETE request arrives at `/api/images/{imageId}`, THE System SHALL remove the image from Cloudinary, delete the corresponding record from the database, and return a 200 status
4. WHEN a PATCH request arrives at `/api/images/reorder/{section}`, THE System SHALL accept a JSON array of image IDs with new display_order values, update the database, and return the reordered images
5. WHEN a PATCH request arrives at `/api/images/{imageId}/cover`, THE System SHALL set `is_cover = 1` for the specified image and set `is_cover = 0` for all other images in the same product/section, returning the updated image
6. WHEN a GET request arrives at `/api/images/section/{sectionKey}`, THE System SHALL return all images for the specified section with `section_key` matching the parameter, ordered by `display_order`, including full image objects with URL, alt_text, width, height
7. WHEN a GET request arrives at `/api/images/product/{productId}`, THE System SHALL return all product_images records where `product_id` matches, ordered by display_order, including cover image flag
8. WHEN a GET request arrives at `/api/images/category/{categoryId}`, THE System SHALL return the image_url from the categories table for the specified category ID
9. WHEN a GET request arrives at `/api/images/editorial`, THE System SHALL return all active editorial_strips with image_urls, ordered by display_order

### Requirement 4: One-Time Image Migration Endpoint

**User Story:** As an admin, I want a single migration endpoint that uploads all 76 existing boutique images to Cloudinary and updates the database so I only run this once.

#### Acceptance Criteria

1. WHEN a POST request arrives at `/api/images/migrate` with admin authorization, THE System SHALL iterate over all 76 images in `/uploads/prod_boutique_XX/` directory (where XX ranges 01-76)
2. THE System SHALL upload each image to Cloudinary with a public_id of format `royals/boutique/{original_filename}`
3. WHEN an image is successfully uploaded, THE System SHALL store the returned Cloudinary URL in the corresponding `product_images` record for the associated product
4. WHEN a migration error occurs for a specific image, THE System SHALL log the error with image filename and product ID but continue processing remaining images
5. AFTER all images are processed, THE System SHALL return a migration report including: total attempted, successfully migrated, failed count, list of failed items with reasons, and timestamp
6. IF the endpoint is called more than once, THE System SHALL check for existing Cloudinary URLs and skip images that are already migrated to prevent duplicates

### Requirement 5: Database URL Storage and Persistence

**User Story:** As a developer, I want image URLs permanently stored in the database so that images persist across all deployments and restarts.

#### Acceptance Criteria

1. WHEN an image is uploaded via `/api/images/upload`, THE System SHALL insert the Cloudinary URL into the appropriate database table (product_images, categories, or editorial_strips) before returning the response
2. WHEN the application restarts, THE System SHALL load all image URLs from the database and serve them from the persisted records, not from temporary file storage
3. WHEN a product, category, or editorial section is queried, THE System SHALL include all associated image URLs from the database in the response payload
4. WHEN the database is persisted to disk (via persistDb() function), THE System SHALL include all image URL records in the database export
5. WHEN a product is deleted, THE System SHALL cascade-delete all associated product_images records and remove images from Cloudinary

### Requirement 6: React Components and Hooks for Image Consumption

**User Story:** As a frontend developer, I want a reusable hook and updated components that fetch and display images with lazy loading and error states.

#### Acceptance Criteria

1. THE System SHALL provide a `useImages()` hook that accepts parameters: `type` (product/category/section), `targetId` or `sectionKey`, and returns an object containing: `images` (array), `isLoading` (boolean), `error` (string or null), `refetch` (function)
2. WHEN the hook is mounted, THE System SHALL call the appropriate GET endpoint (`/api/images/product/{productId}` or `/api/images/section/{sectionKey}`) based on the `type` parameter
3. IF the API request fails, THE System SHALL set `error` with a descriptive message and provide a `refetch` function to retry
4. WHEN `ProductImageGallery` component renders, THE System SHALL use `useImages()` to fetch product images, display the cover image as primary, and render remaining images as thumbnails
5. WHEN `EditorialStrip` component renders, THE System SHALL use `useImages()` to fetch editorial section images and display them in order of display_order
6. WHEN `CategoryShowcase` component renders, THE System SHALL fetch the category image_url and display it with alt_text
7. WHEN a component's image fails to load, THE System SHALL display a fallback placeholder image from `/images/placeholder.jpg`
8. THE System SHALL implement `loading="lazy"` attribute on all `<img>` elements to defer off-screen image loading

### Requirement 7: Image Optimization and Responsive Sizing

**User Story:** As a performance engineer, I want images optimized for different devices so that mobile users download smaller files and desktop users get high-quality images.

#### Acceptance Criteria

1. WHEN a Product Image Gallery is rendered on mobile (viewport < 600px), THE System SHALL use Cloudinary transformation URL with width=600px
2. WHEN a Product Image Gallery is rendered on tablet (viewport 600-1024px), THE System SHALL use Cloudinary transformation URL with width=768px
3. WHEN a Product Image Gallery is rendered on desktop (viewport > 1024px), THE System SHALL use Cloudinary transformation URL with width=1200px
4. WHEN Hero section images are displayed, THE System SHALL use Cloudinary transformation URL with width=1920px, quality=auto, and fetch-format=auto
5. WHEN thumbnail images are displayed in galleries, THE System SHALL use Cloudinary transformation URL with width=400px
6. ALL image `<img>` elements SHALL include `object-fit: cover` CSS property to maintain aspect ratio without distortion
7. WHEN images are served, THE System SHALL include `srcset` attributes with 1x and 2x density variations for retina display support (e.g., `srcset="url-1x 1x, url-2x 2x"`)
8. THE System SHALL apply Cloudinary transformations with `quality: 'auto'` to negotiate optimal compression based on browser and device

### Requirement 8: Persistence Guarantee and Resilience

**User Story:** As a user, I want images to remain available after any application event (restart, deployment, git sync) so I can reliably access product imagery.

#### Acceptance Criteria

1. WHEN the application restarts, THE System SHALL load all image URLs from the SQLite database, not from ephemeral file storage
2. WHEN a new deployment occurs, THE System SHALL preserve all database records including image URLs through the git commit/push cycle
3. WHEN a git sync operation occurs (e.g., `git pull`), THE System SHALL maintain database records in the `/data/royals.sqlite` file and not lose image URL data
4. WHEN the application crashes and is restarted, THE System SHALL verify database integrity and reload persisted image URLs without data loss
5. WHEN Cloudinary becomes temporarily unavailable, THE System SHALL still serve image URLs from the database cache (URLs remain valid)
6. WHEN a user navigates away and returns later, THE System SHALL fetch images from the database on subsequent requests (no session loss)

### Requirement 9: Admin-Only Migration Protection

**User Story:** As a system admin, I want the migration endpoint protected so that only authorized admins can trigger the one-time image migration.

#### Acceptance Criteria

1. THE System SHALL require an authenticated JWT token with `role: 'super_admin'` to be sent in the Authorization header for the POST `/api/images/migrate` endpoint
2. IF a request to `/api/images/migrate` is made without a valid admin token, THE System SHALL return HTTP 401 (Unauthorized)
3. IF a request to `/api/images/migrate` is made with a valid user token (role != 'super_admin'), THE System SHALL return HTTP 403 (Forbidden)
4. THE System SHALL log all migration attempts (successful and failed) with timestamp, admin username, and status

### Requirement 10: Error Handling and Validation

**User Story:** As a developer, I want robust error handling so that failed uploads don't corrupt the database and users see meaningful error messages.

#### Acceptance Criteria

1. WHEN an image upload to Cloudinary fails, THE System SHALL return HTTP 400 with a JSON error object: `{ error: "Cloudinary upload failed: {reason}" }`
2. WHEN a required parameter is missing from a request (e.g., `product_id` for product images), THE System SHALL return HTTP 400 with a JSON error: `{ error: "Missing required parameter: product_id" }`
3. WHEN a database operation fails, THE System SHALL rollback the transaction, return HTTP 500 with a generic error message, and log the full error to console
4. WHEN an image file upload exceeds 10MB, THE System SHALL return HTTP 413 with a message: `{ error: "File size exceeds maximum of 10MB" }`
5. WHEN an image file has an unsupported MIME type (not jpeg, png, webp, gif), THE System SHALL return HTTP 415 with a message: `{ error: "Unsupported file type. Allowed: jpeg, png, webp, gif" }`
6. THE System SHALL validate that `product_id`, `category_id`, or `sectionKey` parameters reference existing database records before processing

### Requirement 11: Image Metadata Capture

**User Story:** As a catalog manager, I want to capture and store image dimensions and alt text so that accessibility and layout calculations are improved.

#### Acceptance Criteria

1. WHEN an image is uploaded via Cloudinary, THE System SHALL extract the image dimensions (`width`, `height`) from the Cloudinary response and store them in the product_images table
2. WHEN an image URL is saved to the database, THE System SHALL accept an optional `alt_text` parameter and store it in the corresponding table
3. WHEN product images are served via GET endpoints, THE System SHALL include `width`, `height`, and `alt_text` in the response payload
4. WHEN homepage sections are served, THE System SHALL include alt_text for each image in the `image_urls_json` array

### Requirement 12: Homepage Section Image Management

**User Story:** As a merchandiser, I want to manage images for featured collections, new arrivals, best sellers, and trending sections independently so I can curate homepage content.

#### Acceptance Criteria

1. THE System SHALL support section_keys: `featured-collections`, `new-arrivals`, `best-sellers`, `trending`
2. WHEN a POST request arrives at `/api/images/upload` with `target_type: 'section'` and `sectionKey`, THE System SHALL create or update records in the homepage_sections table
3. WHEN a GET request arrives at `/api/images/section/{sectionKey}`, THE System SHALL return all images for that section with metadata, ordered by display_order
4. WHEN a section has `is_active: 0`, THE System SHALL exclude it from public-facing API responses but still allow admin access for editing
5. THE System SHALL support up to 20 images per section, enforced by the API (return HTTP 409 if limit exceeded)
