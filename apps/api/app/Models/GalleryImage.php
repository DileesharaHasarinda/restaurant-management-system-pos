<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GalleryImage extends Model
{
    protected $fillable = [
        'title',
        'image_path',
        'alt_text',
        'sort_order',
        'is_active',
        'uploaded_by',
    ];

    protected function casts(): array
    {
        return [
            'sort_order' =>
            'integer',

            'is_active' =>
            'boolean',
        ];
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'uploaded_by'
        );
    }
}
