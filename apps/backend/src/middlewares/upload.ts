import multer, { StorageEngine } from 'multer';
import path from 'path';
import fs from 'fs';

// Buat folder uploads jika belum ada
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Konfigurasi storage
const storage: StorageEngine = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Format: TIMESTAMP-RANDOM-ORIGINALNAME
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  },
});

// Filter file
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Hanya terima image
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Hanya file gambar (JPEG, PNG, GIF, WebP) yang diizinkan'));
  }
};

// Buat instance multer
export const uploadReceipt = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Helper function untuk generate URL
export function getReceiptUrl(filename: string): string {
  // Relative path yang akan di-serve dari backend
  return `/uploads/${filename}`;
}

// Helper function untuk delete file
export function deleteReceiptFile(filename: string | null): void {
  if (!filename) return;
  
  try {
    const filepath = path.join(uploadDir, path.basename(filename));
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
  } catch (err) {
    console.error('Error deleting file:', err);
  }
}
