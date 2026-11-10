import React from 'react';
import {
  Combine, GitCompare, FileEdit, FilePlus, FileSearch, FileText, FolderOutput, Grid, Hash, Image, ImagePlus,
  Layers, Lock, Minimize2, PenTool, RefreshCw, RotateCw, ScanText, ShieldCheck, Split, Stamp, Tag, Trash2,
  Unlock, Code, FolderOpen, Archive, Table, Presentation, Eye
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  Combine, GitCompare, FileEdit, FilePlus, FileSearch, FileText, FolderOutput, Grid, Hash, Image, ImagePlus,
  Layers, Lock, Minimize2, PenTool, RefreshCw, RotateCw, ScanText, ShieldCheck, Split, Stamp, Tag, Trash2,
  Unlock, Code, FolderOpen, Archive, Table, Presentation, Eye
};

export const ToolIcon: React.FC<{ name: string; className?: string }> = ({ name, className = 'w-5 h-5' }) => {
  const Icon = ICONS[name] ?? FileText;
  return <Icon className={className} />;
};
