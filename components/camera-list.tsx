'use client';

import { motion } from 'framer-motion';
import { Camera, Trash2, RefreshCw, Wifi, Radio, Pencil } from 'lucide-react';
import { CameraConfig } from '@/lib/types';
import { useState } from 'react';

interface CameraListProps {
  cameras: CameraConfig[];
  selectedCamera: CameraConfig | null;
  onSelect: (camera: CameraConfig) => void;
  onRefresh: () => void;
  onEdit?: (camera: CameraConfig) => void;
}

export default function CameraList({
  cameras,
  selectedCamera,
  onSelect,
  onRefresh,
  onEdit,
}: CameraListProps) {
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this camera?')) return;
    
    setDeleting(id);
    try {
      await fetch(`/api/config/cameras?id=${id}`, { method: 'DELETE' });
      onRefresh();
    } catch (error) {
      console.error('Delete error:', error);
    } finally {
      setDeleting(null);
    }
  };

  const getProtocolIcon = (protocol: string) => {
    switch (protocol) {
      case 'onvif':
        return <Wifi className="w-4 h-4" />;
      case 'pelcod':
      case 'ujin':
        return <Radio className="w-4 h-4" />;
      default:
        return <Camera className="w-4 h-4" />;
    }
  };

  if (!cameras || cameras?.length === 0) {
    return (
      <div className="text-center py-8">
        <Camera className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">No cameras configured</p>
        <p className="text-muted-foreground/70 text-xs mt-1">Click + to add a camera</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end mb-2">
        <button
          onClick={onRefresh}
          className="p-1.5 hover:bg-muted rounded transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {cameras?.map?.((camera, index) => (
        <motion.div
          key={camera?.id ?? index}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          onClick={() => onSelect(camera)}
          className={`p-3 rounded-lg cursor-pointer transition-all ${
            selectedCamera?.id === camera?.id
              ? 'bg-primary/30 border border-primary/50'
              : 'bg-muted/30 hover:bg-muted/50 border border-transparent'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                selectedCamera?.id === camera?.id ? 'bg-primary/30' : 'bg-muted/50'
              }`}>
                {getProtocolIcon(camera?.protocol ?? 'pelcod')}
              </div>
              <div>
                <h3 className="font-medium text-sm">{camera?.name ?? 'Unnamed Camera'}</h3>
                <p className="text-xs text-muted-foreground">
                  {camera?.protocol?.toUpperCase?.() ?? 'Unknown'} • {camera?.operationMode === 'proxy' ? 'Proxy' : 'Direct'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.(camera);
                }}
                className="p-1.5 hover:bg-primary/30 rounded transition-colors text-muted-foreground hover:text-primary"
                title="Edit"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => handleDelete(camera?.id ?? '', e)}
                disabled={deleting === camera?.id}
                className="p-1.5 hover:bg-destructive/30 rounded transition-colors text-muted-foreground hover:text-destructive"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
