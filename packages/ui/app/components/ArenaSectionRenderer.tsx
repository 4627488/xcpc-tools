import { Box, Card, Group, Stack, Text, Tooltip, useMantineTheme } from '@mantine/core';
import React from 'react';
import { ArenaLayoutSectionDocument } from '../arena/types';

const SEAT_ASPECT_RATIO = 3;

interface ArenaSectionRendererProps {
  section: ArenaLayoutSectionDocument;
  zoom?: number;
  getSeatProps?: (seatId: string) => {
    color?: string;
    tooltip?: React.ReactNode;
    content?: React.ReactNode;
    onClick?: () => void;
    cursor?: string;
  };
}

export function ArenaSectionRenderer({ section, zoom = 1, getSeatProps }: ArenaSectionRendererProps) {
  const theme = useMantineTheme();
  const monospaceFont = theme.fontFamilyMonospace ?? 'monospace';

  const gapSize = (section.gapSize ?? 8) * zoom;
  const seatHeight = (section.seatSize ?? 36) * zoom;
  const seatWidth = seatHeight * SEAT_ASPECT_RATIO;

  return (
    <Stack gap={gapSize}>
      {section.grid.map((row, rowIndex) => {
        const label = section.rowLabels?.[rowIndex] ?? null;
        return (
          <Group key={`${section.id}-row-${rowIndex}`} gap={gapSize} wrap="nowrap" align="center">
            {label ? (
              <Box
                style={{
                  width: seatWidth,
                  minWidth: seatWidth,
                  height: seatHeight,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: Math.max(2, 4 * zoom),
                  color: theme.colors.gray[7],
                  fontSize: theme.fontSizes.sm,
                  flex: '0 0 auto',
                  fontFamily: monospaceFont,
                }}
              >
                {label}
              </Box>
            ) : null}
            {row.map((seatId, cellIndex) => {
              if (!seatId) {
                return (
                  <Box
                    key={`${section.id}-${rowIndex}-${cellIndex}-gap`}
                    style={{ width: seatWidth, height: seatHeight, flex: '0 0 auto' }}
                  />
                );
              }

              const props = getSeatProps?.(seatId) ?? {};
              const { color = theme.colors.gray[3], tooltip, content, onClick, cursor = 'default' } = props;

              const card = (
                <Card
                  padding={Math.max(2, 4 * zoom)}
                  shadow="sm"
                  radius="sm"
                  onClick={onClick}
                  style={{
                    width: seatWidth,
                    height: seatHeight,
                    cursor,
                    backgroundColor: color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    userSelect: 'none',
                    flex: '0 0 auto',
                  }}
                >
                  <Text
                    fw={600}
                    size="sm"
                    c="white"
                    style={{
                      textShadow: '0 0 4px rgba(0,0,0,0.5)',
                      fontFamily: monospaceFont,
                    }}
                  >
                    {seatId}
                  </Text>
                  {content}
                </Card>
              );

              if (tooltip) {
                return (
                  <Tooltip key={`${section.id}-${rowIndex}-${cellIndex}`} label={tooltip} position="top" withArrow>
                    {card}
                  </Tooltip>
                );
              }

              return <React.Fragment key={`${section.id}-${rowIndex}-${cellIndex}`}>{card}</React.Fragment>;
            })}
          </Group>
        );
      })}
    </Stack>
  );
}
