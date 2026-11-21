<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Re-encodes an uploaded raster image with GD before it is stored.
 *
 * Decoding then re-encoding drops EXIF/GPS metadata and any payload
 * appended to or embedded in the original file (polyglots).
 */
final class ImageSanitizer
{
    private const ENCODERS = [
        'image/jpeg' => ['jpg', 'imagejpeg'],
        'image/png' => ['png', 'imagepng'],
        'image/webp' => ['webp', 'imagewebp'],
    ];

    public static function storeReencoded(
        UploadedFile $file,
        string $directory,
        string $disk
    ): string {
        $mime = $file->getMimeType();

        if (! isset(self::ENCODERS[$mime])) {
            throw new RuntimeException('Unsupported image type.');
        }

        [$extension, $encoder] = self::ENCODERS[$mime];

        $image = @imagecreatefromstring((string) file_get_contents($file->getRealPath()));

        if ($image === false) {
            throw new RuntimeException('The uploaded file is not a valid image.');
        }

        if ($mime === 'image/png' || $mime === 'image/webp') {
            imagealphablending($image, false);
            imagesavealpha($image, true);
        }

        ob_start();
        $encoder($image);
        $bytes = (string) ob_get_clean();
        imagedestroy($image);

        $path = trim($directory, '/') . '/' . Str::random(40) . '.' . $extension;

        Storage::disk($disk)->put($path, $bytes);

        return $path;
    }
}
