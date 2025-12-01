import {
  ActionIcon,
  Box,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Text,
  Title,
  useMantineTheme,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconDeviceFloppy,
  IconDownload,
  IconRotateClockwise,
  IconZoomIn,
  IconZoomOut,
  IconZoomReset,
} from '@tabler/icons-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArenaLayoutDocument, ArenaLayoutSectionDocument } from '../arena/types';
import { ArenaSectionRenderer } from '../components/ArenaSectionRenderer';

const STORAGE_KEY = 'xcpc-tools/arena-layouts';
const DEFAULT_LAYOUT_KEY = 'xcpc-tools/arena-layout-selected';
const isBrowser = typeof window !== 'undefined';
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.1;

// Helper to load layouts (duplicated from ArenaView for now to avoid refactoring)
const loadLayoutsFromStorage = (): ArenaLayoutDocument[] => {
  if (!isBrowser) return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    // Simplified parsing for now, assuming valid structure if it exists
    return Array.isArray(parsed) ? parsed as ArenaLayoutDocument[] : [];
  } catch (error) {
    console.warn('Failed to parse stored arena layouts:', error);
    return [];
  }
};

interface SectionState {
  x: number;
  y: number;
  rotation: number;
}

export default function ArenaEditor() {
  const theme = useMantineTheme();
  const [layouts, setLayouts] = useState<ArenaLayoutDocument[]>(() => loadLayoutsFromStorage());
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(() => {
    if (!isBrowser) return null;
    return window.localStorage.getItem(DEFAULT_LAYOUT_KEY);
  });

  const [sectionStates, setSectionStates] = useState<Record<string, SectionState>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.4);
  const previousZoomRef = useRef(zoom);

  const layout = layouts.find((l) => l.id === selectedLayoutId);

  useEffect(() => {
    if (!layout) {
      setSectionStates({});
      setSelectedSectionId(null);
      setDraggingId(null);
      return;
    }
    const newStates: Record<string, SectionState> = {};
    layout.sections.forEach((section, index) => {
      const meta = section.meta as any;
      newStates[section.id] = {
        x: meta?.x ?? 50 + (index * 20),
        y: meta?.y ?? 50 + (index * 20),
        rotation: meta?.rotation ?? 0,
      };
    });
    setSectionStates(newStates);
    setSelectedSectionId(null);
    setDraggingId(null);
  }, [layout]);

  const updateZoom = useCallback((delta: number) => {
    setZoom((current) => {
      const next = Number((current + delta).toFixed(2));
      return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    });
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1);
  }, []);

  const handleMouseDown = (event: React.MouseEvent, sectionId: string) => {
    event.stopPropagation();
    const state = sectionStates[sectionId];
    const canvas = canvasRef.current;
    if (!state || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    setDraggingId(sectionId);
    setSelectedSectionId(sectionId);
    setDragOffset({
      x: cursorX - state.x * zoom,
      y: cursorY - state.y * zoom,
    });
  };

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!draggingId || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    setSectionStates((prev) => {
      const target = prev[draggingId];
      if (!target) return prev;
      return {
        ...prev,
        [draggingId]: {
          ...target,
          x: (cursorX - dragOffset.x) / zoom,
          y: (cursorY - dragOffset.y) / zoom,
        },
      };
    });
  }, [draggingId, dragOffset, zoom]);

  const handleMouseUp = useCallback(() => {
    setDraggingId(null);
  }, []);

  useEffect(() => {
    if (draggingId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingId, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    const zoomChanged = previousZoomRef.current !== zoom;
    if (zoomChanged && draggingId) {
      setDraggingId(null);
    }
    previousZoomRef.current = zoom;
  }, [zoom, draggingId]);

  const rotateSection = useCallback((sectionId: string, angle: number) => {
    setSectionStates((prev) => ({
      ...prev,
      [sectionId]: {
        ...prev[sectionId],
        rotation: (prev[sectionId].rotation + angle) % 360,
      },
    }));
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedSectionId) return;
      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        rotateSection(selectedSectionId, event.shiftKey ? -90 : 90);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedSectionId, rotateSection]);

  const saveLayout = () => {
    if (!layout) return;
    const updatedLayout = {
      ...layout,
      sections: layout.sections.map((section) => ({
        ...section,
        meta: {
          ...section.meta,
          x: sectionStates[section.id]?.x ?? 0,
          y: sectionStates[section.id]?.y ?? 0,
          rotation: sectionStates[section.id]?.rotation ?? 0,
        },
      })),
    };

    const newLayouts = layouts.map((l) => (l.id === layout.id ? updatedLayout : l));
    setLayouts(newLayouts);
    if (isBrowser) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(newLayouts));
    }
    notifications.show({ title: 'Saved', message: 'Layout positions saved to local storage', color: 'green' });
  };

  const downloadLayout = () => {
    if (!layout) {
      notifications.show({ title: 'No layout', message: '请选择一个布局再下载', color: 'yellow' });
      return;
    }
    const updatedLayout = {
      ...layout,
      sections: layout.sections.map((section) => ({
        ...section,
        meta: {
          ...section.meta,
          x: sectionStates[section.id]?.x ?? 0,
          y: sectionStates[section.id]?.y ?? 0,
          rotation: sectionStates[section.id]?.rotation ?? 0,
        },
      })),
    };

    const data = JSON.stringify(updatedLayout, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const baseName = (updatedLayout.name || updatedLayout.id || 'arena-layout').replace(/\s+/g, '_');
    a.href = url;
    a.download = `${baseName}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    notifications.show({ title: 'Downloaded', message: '布局 JSON 已下载', color: 'green' });
  };

  const renderSection = (section: ArenaLayoutSectionDocument) => {
    const state = sectionStates[section.id];
    if (!state) return null;

    const isSelected = selectedSectionId === section.id;
    const cursor = draggingId === section.id ? 'grabbing' : 'grab';
    const overlayRotation = `rotate(${-state.rotation}deg)`;

    return (
      <Box
        key={section.id}
        style={{
          position: 'absolute',
          left: state.x * zoom,
          top: state.y * zoom,
          transform: `rotate(${state.rotation}deg)`,
          transformOrigin: 'center center',
          cursor,
          userSelect: 'none',
          zIndex: draggingId === section.id || isSelected ? 10 : 1,
        }}
        onMouseDown={(event) => handleMouseDown(event, section.id)}
      >
        <Box
          style={{
            position: 'absolute',
            top: 4,
            left: 4,
            transform: overlayRotation,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            pointerEvents: 'none',
          }}
        >
          <Text
            size="xs"
            fw={700}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              borderRadius: 4,
              padding: '2px 6px',
            }}
          >
            {section.title || section.id}
          </Text>
        </Box>
        <ActionIcon
          size="sm"
          variant="light"
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            transform: overlayRotation,
            boxShadow: theme.shadows.xs,
          }}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={() => rotateSection(section.id, 90)}
        >
          <IconRotateClockwise size={14} />
        </ActionIcon>
        <Box
          style={{
            outline: `1px dashed ${theme.colors.gray[4]}`,
            outlineOffset: 4,
            padding: 4,
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
          }}
        >
          <ArenaSectionRenderer
            section={section}
            zoom={zoom}
            getSeatProps={() => ({
              color: isSelected ? theme.colors.indigo[5] : theme.colors.blue[4],
              cursor,
            })}
          />
        </Box>
      </Box>
    );
  };

  return (
    <Stack h="calc(100vh - 100px)">
      <Group justify="space-between" align="center">
        <Title order={3}>Arena Editor</Title>
        <Group gap="sm" align="center">
          <Select
            data={layouts.map((l) => ({ value: l.id, label: l.name }))}
            value={selectedLayoutId}
            onChange={setSelectedLayoutId}
            placeholder="Select Layout"
            style={{ width: 220 }}
          />
          <Group gap={6} align="center">
            <Text size="sm">Zoom</Text>
            <Group gap={4} align="center">
              <ActionIcon
                variant="light"
                aria-label="Zoom out"
                onClick={() => updateZoom(-ZOOM_STEP)}
                disabled={zoom <= MIN_ZOOM}
              >
                <IconZoomOut size={16} />
              </ActionIcon>
              <ActionIcon
                variant="light"
                aria-label="Reset zoom"
                onClick={resetZoom}
                disabled={zoom === 1}
              >
                <IconZoomReset size={16} />
              </ActionIcon>
              <ActionIcon
                variant="light"
                aria-label="Zoom in"
                onClick={() => updateZoom(ZOOM_STEP)}
                disabled={zoom >= MAX_ZOOM}
              >
                <IconZoomIn size={16} />
              </ActionIcon>
            </Group>
            <Text size="sm" c="dimmed">{Math.round(zoom * 100)}%</Text>
          </Group>
          <Button leftSection={<IconDeviceFloppy size={16} />} onClick={saveLayout}>
            Save
          </Button>
          <Button variant="light" leftSection={<IconDownload size={16} />} onClick={downloadLayout}>
            Download JSON
          </Button>
          <Text size="xs" c="dimmed">
            拖动时按 R 旋转 (Shift+R 反向)
          </Text>
        </Group>
      </Group>

      <Card
        withBorder
        p={0}
        style={{ flex: 1, overflow: 'auto', position: 'relative' }}
      >
        <Box
          ref={canvasRef}
          style={{
            position: 'relative',
            minHeight: 800,
            minWidth: 1200,
            backgroundColor: '#f8f9fa',
          }}
          onPointerDown={() => setSelectedSectionId(null)}
        >
          {layout ? (
            layout.sections.map(renderSection)
          ) : (
            <Box p="xl">
              <Text c="dimmed" ta="center">Select a layout to edit</Text>
            </Box>
          )}
        </Box>
      </Card>
    </Stack>
  );
}
