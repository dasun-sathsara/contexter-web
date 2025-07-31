'use client';
import { FileNode } from '@/lib/types';
import {
    FileText,
    Folder,
    FolderOpen,
    ChevronLeft,
    FileCode,
    FileCog,
    FileJson,
    Database,
    Globe,
    Palette,
    BookOpen,
    FileKey,
    Terminal,
    FileSpreadsheet
} from 'lucide-react';
import { useFileStore } from '@/stores/file-store';
import { cn } from '@/lib/utils';

interface FileTreeItemProps {
    item: FileNode;
    onDoubleClick?: () => void;
}

// Enhanced file icon mapping for text-based files only
const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';

    // JavaScript/TypeScript files
    if (['js', 'jsx', 'mjs', 'cjs'].includes(extension)) {
        return FileCode;
    }
    if (['ts', 'tsx', 'mts', 'cts'].includes(extension)) {
        return FileCode;
    }

    // Web framework files
    if (['vue', 'svelte', 'astro'].includes(extension)) {
        return FileCode;
    }

    // JSON and data files
    if (['json', 'json5', 'jsonl'].includes(extension)) {
        return FileJson;
    }

    // Web markup and styling
    if (['html', 'htm', 'xml', 'xhtml', 'svg'].includes(extension)) {
        return Globe;
    }
    if (['css', 'scss', 'sass', 'less', 'stylus', 'postcss'].includes(extension)) {
        return Palette;
    }

    // Programming languages
    if (['py', 'pyw', 'pyc', 'pyo', 'pyd'].includes(extension)) {
        return FileCode;
    }
    if (['rb', 'rbw', 'rake', 'gemspec'].includes(extension)) {
        return FileCode;
    }
    if (['php', 'phtml', 'phar'].includes(extension)) {
        return FileCode;
    }
    if (['java', 'class', 'jar'].includes(extension)) {
        return FileCode;
    }
    if (['c', 'h', 'cpp', 'cxx', 'cc', 'hpp', 'hxx'].includes(extension)) {
        return FileCode;
    }
    if (['cs', 'csx', 'vb'].includes(extension)) {
        return FileCode;
    }
    if (['go', 'mod', 'sum'].includes(extension)) {
        return FileCode;
    }
    if (['rs', 'toml'].includes(extension)) {
        return FileCode;
    }
    if (['kt', 'kts'].includes(extension)) {
        return FileCode;
    }
    if (['swift'].includes(extension)) {
        return FileCode;
    }
    if (['dart'].includes(extension)) {
        return FileCode;
    }

    // Database and query files
    if (['sql', 'mysql', 'pgsql', 'sqlite', 'db'].includes(extension)) {
        return Database;
    }

    // Configuration files
    if (['yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'config'].includes(extension)) {
        return FileCog;
    }
    if (['dockerfile', 'dockerignore', 'docker-compose'].includes(extension) ||
        fileName.toLowerCase() === 'dockerfile') {
        return FileCog;
    }

    // Shell and script files
    if (['sh', 'bash', 'zsh', 'fish', 'ps1', 'psm1', 'bat', 'cmd'].includes(extension)) {
        return Terminal;
    }

    // Markup and documentation
    if (['md', 'mdx', 'markdown', 'txt', 'rst', 'adoc', 'tex'].includes(extension)) {
        return BookOpen;
    }

    // Data and spreadsheet files (text-based)
    if (['csv', 'tsv', 'dsv'].includes(extension)) {
        return FileSpreadsheet;
    }

    // Special dotfiles and config files
    if (fileName.startsWith('.env') ||
        ['.gitignore', '.gitattributes', '.editorconfig', '.eslintrc', '.prettierrc', '.babelrc',
            '.stylelintrc', '.huskyrc', '.lintstagedrc', '.commitlintrc'].includes(fileName) ||
        fileName.startsWith('.eslintrc') || fileName.startsWith('.prettierrc')) {
        return FileCog;
    }

    // Package and dependency files
    if (['package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'composer.json',
        'requirements.txt', 'Pipfile', 'pyproject.toml', 'Cargo.toml', 'Cargo.lock',
        'go.mod', 'go.sum', 'pubspec.yaml'].includes(fileName)) {
        return FileCog;
    }

    // Security and key files
    if (['key', 'pem', 'cert', 'crt', 'csr', 'p12', 'pfx'].includes(extension)) {
        return FileKey;
    }

    // Default text file icon
    return FileText;
};

interface FileTreeItemProps {
    item: FileNode;
    onDoubleClick?: () => void;
}

export function FileTreeItem({ item, onDoubleClick }: FileTreeItemProps) {
    const { cursorPath, setCursor, selectedPaths, navigateInto, settings } = useFileStore();

    const isCursor = cursorPath === item.path;
    const isSelected = selectedPaths.has(item.path);
    const isBack = item.path === '..';

    // Get icon color based on file type
    const getIconColor = () => {
        if (isBack) return 'text-muted-foreground';
        if (item.is_dir) return 'text-blue-600 dark:text-blue-400';

        const extension = item.name.split('.').pop()?.toLowerCase() || '';

        // JavaScript/TypeScript - yellow/amber
        if (['js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'mts', 'cts'].includes(extension)) {
            return 'text-yellow-600 dark:text-yellow-400';
        }

        // Web frameworks - green
        if (['vue', 'svelte', 'astro'].includes(extension)) {
            return 'text-green-600 dark:text-green-400';
        }

        // JSON - orange
        if (['json', 'json5', 'jsonl'].includes(extension)) {
            return 'text-orange-600 dark:text-orange-400';
        }

        // HTML/XML - red
        if (['html', 'htm', 'xml', 'xhtml', 'svg'].includes(extension)) {
            return 'text-red-600 dark:text-red-400';
        }

        // CSS - purple
        if (['css', 'scss', 'sass', 'less', 'stylus', 'postcss'].includes(extension)) {
            return 'text-purple-600 dark:text-purple-400';
        }

        // Python - blue
        if (['py', 'pyw', 'pyc', 'pyo', 'pyd'].includes(extension)) {
            return 'text-blue-600 dark:text-blue-400';
        }

        // Database - teal
        if (['sql', 'mysql', 'pgsql', 'sqlite', 'db'].includes(extension)) {
            return 'text-teal-600 dark:text-teal-400';
        }

        // Config files - gray
        if (['yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'config'].includes(extension)) {
            return 'text-gray-600 dark:text-gray-400';
        }

        // Shell scripts - cyan
        if (['sh', 'bash', 'zsh', 'fish', 'ps1', 'psm1', 'bat', 'cmd'].includes(extension)) {
            return 'text-cyan-600 dark:text-cyan-400';
        }

        // Markdown - indigo
        if (['md', 'mdx', 'markdown'].includes(extension)) {
            return 'text-indigo-600 dark:text-indigo-400';
        }

        // Default text files
        return 'text-muted-foreground';
    };

    // Enhanced icon selection with file type awareness
    const getIcon = () => {
        if (isBack) return ChevronLeft;
        if (item.is_dir) return isCursor ? FolderOpen : Folder;
        return getFileIcon(item.name);
    };

    const Icon = getIcon();

    const handleDoubleClick = () => {
        if (onDoubleClick) {
            onDoubleClick();
        } else if (item.is_dir) {
            navigateInto(item.path);
        }
    };

    const handleClick = () => {
        setCursor(item.path);
    };

    const tokenDisplay = () => {
        if (!settings.showTokenCount || typeof item.token_count !== 'number') return null;
        return item.token_count >= 1000 ? `${(item.token_count / 1000).toFixed(1)}k` : item.token_count.toString();
    };

    return (
        <div
            className={cn(
                // Base styles with improved spacing
                'group relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm select-none',
                'transition-colors duration-300 ease-out',
                'hover:bg-muted/60',

                // Cursor state (primary focus indicator)
                isCursor && [
                    'bg-muted/80 border border-border/30',
                    'text-foreground',
                ],

                // Selection state (secondary indicator)
                isSelected && [
                    'bg-blue-50 dark:bg-blue-950/50',
                    'text-blue-900 dark:text-blue-100',
                    'border border-blue-500/30'
                ],

                // Combined cursor + selection state
                isCursor && isSelected && [
                    'bg-blue-100 dark:bg-blue-900/60',
                    'border border-blue-500/40'
                ],

                // Back button special styling
                isBack && [
                    'text-muted-foreground font-medium hover:text-foreground'
                ]
            )}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            data-path={item.path}
        >
            {/* Icon */}
            <div className="relative flex-shrink-0">
                <Icon className={cn(
                    'h-5 w-5 transition-colors duration-300',
                    // Use dynamic color based on file type, but override for cursor/selection states
                    !isCursor && !isSelected ? getIconColor() : '',
                    isCursor && !isBack && 'text-foreground',
                    isSelected && !isBack && 'text-blue-700 dark:text-blue-300'
                )} />
            </div>

            {/* File/folder name */}
            <span className={cn(
                'truncate flex-grow transition-colors duration-300',
                item.is_dir && !isBack && 'font-medium',
                isBack && 'font-medium',
                isCursor && 'text-foreground',
                isSelected && !isBack && 'text-blue-900 dark:text-blue-100'
            )}>
                {isBack ? 'Back to parent' : item.name}
            </span>

            {/* Token count for files */}
            {settings.showTokenCount && !item.is_dir && (
                <span className={cn(
                    'text-xs px-2 py-1 rounded-md font-medium ml-auto bg-muted/60 text-muted-foreground',
                    'transition-colors duration-300',
                    isCursor && 'bg-primary/15 text-primary',
                    isSelected && 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                )}>
                    {tokenDisplay()}
                </span>
            )}

            {/* Token count for directories */}
            {settings.showTokenCount && item.is_dir && !isBack && (
                <span className={cn(
                    'text-xs px-2 py-1 rounded-md font-medium ml-auto bg-blue-500/15 text-blue-600 dark:text-blue-400',
                    'transition-colors duration-300',
                    isCursor && 'bg-blue-500/25 text-blue-700 dark:text-blue-300',
                    isSelected && 'bg-blue-500/30 text-blue-800 dark:text-blue-200'
                )}>
                    {tokenDisplay()}
                </span>
            )}

            {/* Selection indicator */}
            {isSelected && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-blue-500 rounded-r transition-colors duration-300" />
            )}
        </div>
    );
}
