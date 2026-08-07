# Design Document: Permanent Backend Image Management System

## Architecture Overview

The system introduces a three-layer architecture for image management:

1. **Cloud Layer (Cloudinary)**: Persistent cloud storage, CDN delivery, transformations
2. **Persistence Layer (SQLite)**: Database records for image URLs and metadata
3. **API Layer (Express)**: REST endpoints for upload, delete, retrieval, and migration
4. **React Layer**: Hooks and components for consuming persisted image URLs

## Database Schema Design

### Schema Modifications

All image-related data persists in SQLite database (`/data/royals.sqlite`).

#### Table: categories (extends existing)
```sql
ALTER TABLE categories ADD COLUMN image_url TEXT;
-- image_url: Cloudinary URL for the category's primary image
```

#### Table: editorial_strips (extends existing)
```sql
ALTER TABLE editorial_strips ADD COLUMN image_url TEXT;
-- image_url: Cloudinary URL for the editorial strip
```

#### Table: product_images (new)
```sql
CREATE TABLE product_images (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  image_url TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_cover INTEGER DEFAULT 0,
  alt_text TEXT,
  width INTEGER,
  height INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

Indexes:
- `CREATE INDEX idx_product_images_product_id ON product_images(product_id);`
- `CREATE INDEX idx_product_images_is_cover ON product_images(is_cover);`

#### Table: homepage_sections (new)
```sql
CREATE TABLE homepage_sections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  section_key TEXT UNIQUE NOT NULL,
  description TEXT,
  image_urls_json TEXT DEFAULT '[]',
  display_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

Indexes:
- `CREATE INDEX idx_homepage_sections_section_key ON homepage_sections(section_key);`
- `CREATE INDEX idx_homepage_sections_is_active ON homepage_sections(is_active);`

### Image URL Storage Invariant

**Invariant**: Every image referenced by the API exists in exactly one of:
- `categories.image_url`
- `editorial_strips.image_url`
- `product_images.image_url`
- `homepage_sections.image_urls_json` (as JSON array)

A Cloudinary URL persists indefinitely once stored in the database, unaffected by application restarts or deployments.

## Cloudinary Service Design

### CloudinaryService (src/services/cloudinary.ts)

Encapsulates all Cloudinary SDK interactions.

```typescript
class CloudinaryService {
  // Initialize with credentials from environment
  constructor(cloudName: string, apiKey: string, apiSecret: string)

  // Upload image file to Cloudinary
  async uploadImage(file: File, options: {
    publicId?: string,
    folder?: string
  }): Promise<{
    cloudinaryUrl: string,
    publicId: string,
    width: number,
    height: number,
    format: string
  }>

  // Delete image by public_id
  async deleteImage(publicId: string): Promise<boolean>

  // Generate transformed URL with preset
  generateTransformUrl(url: string, preset: 'gallery' | 'thumbnail' | 'mobile' | 'hero', density: '1x' | '2x'): string
}
```

**Transformation Presets**:
- `gallery`: width=1200, quality=auto, fetch-format=auto
- `thumbnail`: width=400, quality=auto, fetch-format=auto
- `mobile`: width=600, quality=auto, fetch-format=auto
- `hero`: width=1920, quality=auto, fetch-format=auto

**Public ID Structure**: `royals/boutique/{original_filename}` for migrated images, `royals/{context}/{uuid}` for new uploads.

## Image Management Service Design

### ImageService (src/services/imageService.ts)

High-level operations on images with database persistence.

```typescript
class ImageService {
  constructor(db: Database, cloudinaryService: CloudinaryService)

  // Upload single or multiple product images
  async uploadProductImages(
    productId: string,
    files: File[],
    userId: string
  ): Promise<ProductImage[]>

  // Upload category image
  async uploadCategoryImage(
    categoryId: string,
    file: File,
    userId: string
  ): Promise<CategoryImage>

  // Upload section images
  async uploadSectionImages(
    sectionKey: string,
    files: File[],
    userId: string
  ): Promise<HomepageSection>

  // Delete image by id
  async deleteImage(imageId: string, table: 'product_images' | 'categories' | 'editorial_strips'): Promise<void>

  // Reorder images within a section or product
  async reorderImages(
    section: 'product' | 'section',
    targetId: string,
    order: Array<{ imageId: string, displayOrder: number }>
  ): Promise<void>

  // Set image as cover/primary
  async setImageCover(imageId: string, table: 'product_images'): Promise<void>

  // Replace existing image
  async replaceImage(imageId: string, newFile: File, table: string): Promise<ImageRecord>

  // Migrate legacy images from /uploads/prod_boutique_XX/
  async migrateExistingImages(): Promise<MigrationReport>
}
```

**Error Handling**:
- If Cloudinary upload fails: throw error, rollback database changes
- If database insert fails: attempt Cloudinary delete, throw error
- If file validation fails: return 400 with specific error message
- Log all errors with context: image filename, product ID, timestamp, Cloudinary response

## Migration Service Design

### MigrationService (src/services/migrationService.ts)

One-time migration of 76 legacy images.

**Process**:
1. Read all files from `/uploads/prod_boutique_XX/` (where XX is 01-76)
2. For each file, extract product_id from filename pattern
3. Upload to Cloudinary with public_id: `royals/boutique/{original_filename}`
4. Extract dimensions (width, height) from Cloudinary response
5. Insert into product_images table with Cloudinary URL
6. On error: log failure with filename and product ID, continue to next image
7. After processing all: generate report with counts and failure list

**Idempotence**: Check for existing Cloudinary URLs before re-uploading (prevent duplicates if migration endpoint called multiple times).

**Report Schema**:
```typescript
{
  totalAttempted: number,
  successCount: number,
  failureCount: number,
  failed: Array<{ filename: string, productId: string, reason: string }>,
  timestamp: string,
  duration: number  // milliseconds
}
```

## API Endpoint Design

### Admin Endpoints (require super_admin role)

All admin endpoints validate JWT token and check `role === 'super_admin'`.

#### POST /api/images/upload
**Request**:
- Body: multipart/form-data
- Fields: `files` (file array), `target_type` (product|category|section), `product_id` or `category_id` or `sectionKey`, `alt_text` (optional)

**Response**:
- 200: Array of image objects with `id`, `image_url`, `width`, `height`, `alt_text`, `display_order`, `is_cover`
- 400: `{ error: "Missing required parameter: product_id" }`
- 401: `{ error: "Unauthorized" }`
- 403: `{ error: "Forbidden - super_admin role required" }`
- 413: `{ error: "File size exceeds maximum of 10MB" }`
- 415: `{ error: "Unsupported file type. Allowed: jpeg, png, webp, gif" }`

#### PATCH /api/images/{imageId}
**Request**:
- Body: multipart/form-data
- Fields: `file` (new file), `alt_text` (optional)

**Response**:
- 200: Updated image object
- 400: `{ error: "File size exceeds maximum of 10MB" }`
- 404: `{ error: "Image not found" }`

#### DELETE /api/images/{imageId}
**Request**: No body

**Response**:
- 200: `{ success: true }`
- 404: `{ error: "Image not found" }`

#### PATCH /api/images/{imageId}/cover
**Request**: No body

**Response**:
- 200: Updated image object with `is_cover: 1`
- 404: `{ error: "Image not found" }`

#### PATCH /api/images/reorder/{section}
**Request**:
- Body: `{ order: [ { imageId: string, displayOrder: number }, ... ] }`

**Response**:
- 200: Array of reordered images

#### POST /api/images/migrate
**Request**: No body (admin authorization required)

**Response**:
- 200: Migration report with counts and failure list
- 401/403: Authorization error

### Public Endpoints (no authentication required)

#### GET /api/images/product/{productId}
**Response**:
- 200: Array of product images
  ```json
  {
    "images": [
      {
        "id": "...",
        "image_url": "https://res.cloudinary.com/...",
        "width": 1200,
        "height": 800,
        "alt_text": "...",
        "display_order": 0,
        "is_cover": 1
      }
    ]
  }
  ```

#### GET /api/images/category/{categoryId}
**Response**:
- 200: `{ image_url: "...", width: 1200, height: 800, alt_text: "..." }`
- 404: `{ error: "Category not found" }`

#### GET /api/images/section/{sectionKey}
**Response**:
- 200: Array of images for that section, ordered by display_order
- 404: `{ error: "Section not found" }`

#### GET /api/images/editorial
**Response**:
- 200: Array of active editorial_strips with image URLs

## React Hooks Design

### useImages Hook (src/hooks/useImages.ts)

```typescript
function useImages(type: 'product' | 'category' | 'section', targetId: string) {
  return {
    images: Array<Image>,
    isLoading: boolean,
    error: string | null,
    refetch: () => Promise<void>
  }
}
```

**Behavior**:
- On mount: fetch from appropriate endpoint based on type
- On error: set error message, provide refetch function
- Refetch: clear error, set loading, retry endpoint
- Cache: images stored in component state (no external cache)

## React Component Updates

### ProductImageGallery Component
- Use `useImages('product', productId)`
- Display cover image as primary
- Render remaining images as thumbnails below
- Apply lazy loading: `loading="lazy"` on all img elements
- Responsive srcset based on viewport

### EditorialStrip Component
- Use `useImages('section', 'editorial')`
- Display images in order of display_order
- Apply transformations for hero preset (1920px)

### CategoryShowcase Component
- Use `useImages('category', categoryId)`
- Fetch and display single category image

### Homepage Components (Featured/Trending/Best-sellers)
- Use `useImages('section', sectionKey)` for each section
- Render images in carousel or grid

## Image Optimization Strategy

### Responsive Sizing

Generate Cloudinary transformation URLs based on viewport:

```typescript
function getTransformUrl(baseUrl: string, viewport: 'mobile' | 'tablet' | 'desktop') {
  const presets = {
    mobile: 'mobile',
    tablet: 'gallery',
    desktop: 'gallery'
  };
  return cloudinaryService.generateTransformUrl(baseUrl, presets[viewport], '1x');
}
```

### Lazy Loading

All product images include `loading="lazy"` attribute:
```jsx
<img src={url} loading="lazy" decoding="async" alt={altText} />
```

### Responsive Images with srcset

For high-density displays:
```jsx
<img
  srcSet={`${url-1x} 1x, ${url-2x} 2x`}
  src={url-1x}
  loading="lazy"
  decoding="async"
  alt={altText}
/>
```

### CSS Styling

All images in galleries use `object-fit: cover`:
```css
.image-gallery img {
  object-fit: cover;
  width: 100%;
  height: 100%;
  aspect-ratio: 1 / 1;
}
```

## Environment Configuration

### .env Variables

```
CLOUDINARY_CLOUD_NAME=<cloud-name>
CLOUDINARY_API_KEY=<api-key>
CLOUDINARY_API_SECRET=<api-secret>
NODE_ENV=production
DATABASE_PATH=/data/royals.sqlite
```

**Validation**: On startup, service checks all required variables are present. If missing, logs error and exits.

## Error Handling Specification

### HTTP Status Codes

| Code | Scenario | Response |
|------|----------|----------|
| 200 | Success | Image object or array |
| 400 | Missing param, invalid file | `{ error: "..." }` |
| 401 | No authorization token | `{ error: "Unauthorized" }` |
| 403 | Insufficient role | `{ error: "Forbidden" }` |
| 404 | Resource not found | `{ error: "Not found" }` |
| 409 | Section image limit exceeded | `{ error: "Max 20 images per section" }` |
| 413 | File too large | `{ error: "File size exceeds maximum of 10MB" }` |
| 415 | Unsupported file type | `{ error: "Unsupported file type" }` |
| 500 | Database or server error | `{ error: "Internal server error" }` |

### Validation Rules

- File size: max 10MB
- Supported formats: JPEG, PNG, WebP, GIF
- Images per section: max 20
- Product images per product: no limit
- Alt text: optional, max 255 characters

### Failure Modes

**Cloudinary Unavailable**: Database contains URLs that remain valid; system returns cached URLs from database.

**Database Failure**: Return 500 error, log full error details, do not update Cloudinary.

**File Upload Failure**: Validate file size and type before sending to Cloudinary; return 400 for client errors.

**Migration Failure**: Log individual image failures with reason; continue processing other images; return report with failure list.

## Data Persistence Guarantee

### Persistence Flow

1. User uploads image via POST /api/images/upload
2. Express endpoint validates request
3. CloudinaryService uploads to Cloudinary
4. ImageService inserts URL into database
5. persistDb() called to commit database to disk
6. Response returned to client with image object

### Deployment Resilience

- Database file `/data/royals.sqlite` is git-committed
- On deployment, database is restored from git
- On application restart, all URLs loaded from database
- On git sync, image URLs persist in database file

### Application Restart Resilience

- On startup, application loads database from disk
- All image URLs read into memory from database records
- GET endpoints serve from memory (no ephemeral file lookup)

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Image Upload Persistence

*For any* valid image file uploaded via POST /api/images/upload with valid `target_type` and `targetId` (product_id/category_id/sectionKey), the returned Cloudinary URL SHALL be retrievable from the database on subsequent requests without data loss, even after application restart.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 5.1, 5.2, 5.4, 8.1, 8.2**

### Property 2: Cover Image Uniqueness

*For any* product with multiple images, calling PATCH /api/images/{imageId}/cover SHALL set `is_cover = 1` for the specified image and automatically set `is_cover = 0` for all other images in the same product, maintaining exactly one cover image per product.

**Validates: Requirements 3.5**

### Property 3: Image Deletion Completeness

*For any* image in the database, calling DELETE /api/images/{imageId} SHALL remove the image from both Cloudinary and the database, ensuring subsequent queries for that product/section do not return the deleted image.

**Validates: Requirements 3.3, 5.5**

### Property 4: Transformation URL Correctness

*For any* image URL stored in the database and *for any* valid viewport preset (mobile/tablet/desktop/hero), calling generateTransformUrl() SHALL return a Cloudinary transformation URL that applies the correct width, quality=auto, and fetch-format=auto parameters.

**Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.8**

### Property 5: Migration Idempotence

*For any* directory of legacy images in /uploads/prod_boutique_XX/, calling POST /api/images/migrate multiple times SHALL result in the same final state: each image uploaded to Cloudinary exactly once with a URL persisted in the database, with no duplicates created.

**Validates: Requirements 4.6**

### Property 6: Authorization Validation

*For any* request to POST /api/images/migrate without a valid JWT token containing `role === 'super_admin'`, the system SHALL return HTTP 401 (Unauthorized) or HTTP 403 (Forbidden) and SHALL NOT process the request.

**Validates: Requirements 9.1, 9.2, 9.3**

### Property 7: Database Cascade Deletion

*For any* product that is deleted from the system, all associated product_images records SHALL be deleted from the database, and all corresponding Cloudinary images SHALL be deleted from Cloudinary, maintaining referential integrity.

**Validates: Requirements 5.5**

### Property 8: Metadata Capture and Retrieval

*For any* image uploaded via POST /api/images/upload, the returned response AND subsequent GET requests for that image SHALL include the captured `width`, `height`, `alt_text`, and `display_order` metadata from the database.

**Validates: Requirements 11.1, 11.2, 11.3, 11.4**

### Property 9: Section Image Limit Enforcement

*For any* homepage section, attempting to upload more than 20 images SHALL return HTTP 409 with error message, and the section SHALL remain unchanged with no images added.

**Validates: Requirements 12.5**

### Property 10: Image Reordering Completeness

*For any* product or section with multiple images, calling PATCH /api/images/reorder/{section} with an array of imageIds and new display_order values SHALL update the display_order of all specified images in the database, and subsequent GET requests SHALL return images sorted by the new display_order values.

**Validates: Requirements 3.4**

### Property 11: Section-Key Resolution

*For any* GET request to /api/images/section/{sectionKey}, the system SHALL return images only for the section matching that sectionKey, ordered by display_order, regardless of how many other sections exist in the database.

**Validates: Requirements 3.6, 12.1, 12.3**

### Property 12: Responsive Image Delivery

*For any* image request from a mobile device (viewport < 600px) to a component using the responsive srcset strategy, the system SHALL deliver a Cloudinary transformation URL with width=600px, and for desktop devices (viewport > 1024px), SHALL deliver width=1200px.

**Validates: Requirements 7.1, 7.2, 7.3, 7.7**

### Property 13: Database Round-Trip Invariant

*For any* image stored in the database with fields (id, product_id, image_url, width, height, alt_text, display_order, is_cover), querying the database for that image SHALL return identical values for all fields, preserving data integrity across persistence operations.

**Validates: Requirements 5.1, 5.3, 5.4, 8.1**

### Property 14: Lazy Loading Attribute Presence

*For any* image rendered via ProductImageGallery, EditorialStrip, CategoryShowcase, or other components, the HTML `<img>` element SHALL include the `loading="lazy"` and `decoding="async"` attributes to enable deferred loading of off-screen images.

**Validates: Requirements 6.8**

### Property 15: Alt Text Accessibility

*For any* image returned via GET endpoints or rendered in React components, the `alt_text` field SHALL be present and non-empty in the response, and SHALL be applied to the HTML `<img>` alt attribute for accessibility compliance.

**Validates: Requirements 6.1, 11.2, 11.3, 11.4**

