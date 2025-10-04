'use client';

import React from 'react';

// Tipos de datos
export type CoverMode = 'auto' | 'template';
export type PaletteId = 'marino' | 'rojo' | 'negro' | 'verde' | 'purpura';
export type TemplateId = 'template-1' | 'template-2' | 'template-3' | 'template-4' | 'template-5' | 'template-6' | 'template-7' | 'template-8';

export interface ColorPalette {
  background: string;
  text: string;
  accent: string;
}

export interface CoverRendererProps {
  mode: CoverMode;
  templateId?: TemplateId;
  title: string;
  author: string;
  paletteId: PaletteId;
  width?: number;
  height?: number;
  className?: string;
}

// Paletas de color con contraste alto
const COLOR_PALETTES = {
  marino: {
    background: '#0B1F3A',
    text: '#FFFFFF',
    accent: '#4A90E2'
  },
  rojo: {
    background: '#7A0F18',
    text: '#FAFAFA',
    accent: '#FF6B6B'
  },
  negro: {
    background: '#111111',
    text: '#F5F5F5',
    accent: '#888888'
  },
  verde: {
    background: '#0E3B2E',
    text: '#FFFFFF',
    accent: '#4ECDC4'
  },
  purpura: {
    background: '#3A1A59',
    text: '#FFFFFF',
    accent: '#9B59B6'
  }
};

// Función para ajustar el tamaño del texto según la longitud
const getTextSize = (text: string, maxSize: number, minSize: number) => {
  const length = text.length;
  if (length <= 20) return maxSize;
  if (length <= 40) return maxSize * 0.8;
  if (length <= 60) return maxSize * 0.6;
  return minSize;
};

// Función para dividir texto en líneas
const splitTextIntoLines = (text: string, maxCharsPerLine: number) => {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach(word => {
    if ((currentLine + word).length <= maxCharsPerLine) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  });

  if (currentLine) lines.push(currentLine);
  return lines;
};

// Función para calcular márgenes seguros
const getSafeMargins = (width: number, height: number) => {
  return {
    horizontal: width * 0.08, // 8% de margen horizontal
    vertical: height * 0.06   // 6% de margen vertical
  };
};

// Plantillas predefinidas
const renderTemplate = (templateId: TemplateId, palette: ColorPalette, width: number, height: number) => {
  // Validación defensiva para palette
  if (!palette || !palette.background || !palette.accent) {
    palette = COLOR_PALETTES.marino;
  }
  
  const { background, accent } = palette;

  switch (templateId) {
    case 'template-1': // Franja diagonal
      return (
        <g>
          <rect width={width} height={height} fill={background} />
          <polygon 
            points={`0,${height * 0.7} ${width * 0.3},0 ${width},0 ${width},${height * 0.3} 0,${height}`}
            fill={accent}
            opacity="0.1"
          />
        </g>
      );

    case 'template-2': // Marco fino
      return (
        <g>
          <rect width={width} height={height} fill={background} />
          <rect 
            x="20" y="20" 
            width={width - 40} 
            height={height - 40} 
            fill="none" 
            stroke={accent} 
            strokeWidth="2"
            opacity="0.3"
          />
        </g>
      );

    case 'template-3': // Patrón de líneas suaves
      return (
        <g>
          <rect width={width} height={height} fill={background} />
          <defs>
            <pattern id="lines" patternUnits="userSpaceOnUse" width="40" height="40">
              <path d="M 0,40 l 40,-40 M -10,10 l 20,-20 M 30,50 l 20,-20" stroke={accent} strokeWidth="1" opacity="0.1"/>
            </pattern>
          </defs>
          <rect width={width} height={height} fill="url(#lines)" />
        </g>
      );

    case 'template-4': // Círculos decorativos
      return (
        <g>
          <rect width={width} height={height} fill={background} />
          <circle cx={width * 0.8} cy={height * 0.2} r="60" fill={accent} opacity="0.1" />
          <circle cx={width * 0.2} cy={height * 0.8} r="40" fill={accent} opacity="0.1" />
        </g>
      );

    case 'template-5': // Gradiente sutil
      return (
        <g>
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={background} />
              <stop offset="100%" stopColor={accent} stopOpacity="0.2" />
            </linearGradient>
          </defs>
          <rect width={width} height={height} fill="url(#gradient)" />
        </g>
      );

    case 'template-6': // Formas geométricas
      return (
        <g>
          <rect width={width} height={height} fill={background} />
          <polygon 
            points={`${width * 0.1},${height * 0.1} ${width * 0.3},${height * 0.1} ${width * 0.2},${height * 0.3}`}
            fill={accent}
            opacity="0.15"
          />
          <polygon 
            points={`${width * 0.7},${height * 0.7} ${width * 0.9},${height * 0.7} ${width * 0.8},${height * 0.9}`}
            fill={accent}
            opacity="0.15"
          />
        </g>
      );

    case 'template-7': // Líneas verticales
      return (
        <g>
          <rect width={width} height={height} fill={background} />
          {[0.1, 0.3, 0.7, 0.9].map((pos, i) => (
            <line 
              key={i}
              x1={width * pos} 
              y1="0" 
              x2={width * pos} 
              y2={height} 
              stroke={accent} 
              strokeWidth="1" 
              opacity="0.1"
            />
          ))}
        </g>
      );

    case 'template-8': // Marco con esquinas redondeadas
      return (
        <g>
          <rect width={width} height={height} fill={background} />
          <rect 
            x="30" y="30" 
            width={width - 60} 
            height={height - 60} 
            fill="none" 
            stroke={accent} 
            strokeWidth="3"
            rx="15"
            opacity="0.2"
          />
        </g>
      );

    default:
      return <rect width={width} height={height} fill={background} />;
  }
};

const CoverRenderer: React.FC<CoverRendererProps> = ({
  mode,
  templateId = 'template-1',
  title,
  author,
  paletteId,
  width = 600,
  height = 900,
  className = ''
}) => {
  // Validación defensiva para paletteId
  const palette = COLOR_PALETTES[paletteId] || COLOR_PALETTES.marino;
  const margins = getSafeMargins(width, height);
  
  // Calcular tamaños de texto con márgenes seguros
  const availableWidth = width - (margins.horizontal * 2);
  const titleSize = getTextSize(title, Math.min(48, availableWidth / 12), 20);
  const authorSize = Math.max(titleSize * 0.6, 16);
  
  // Dividir título en líneas considerando el ancho disponible
  const maxCharsTitle = Math.floor(availableWidth / (titleSize * 0.6));
  const maxCharsAuthor = Math.floor(availableWidth / (authorSize * 0.6));
  const titleLines = splitTextIntoLines(title, Math.max(maxCharsTitle, 15));
  const authorLines = splitTextIntoLines(author, Math.max(maxCharsAuthor, 20));

  return (
    <div className={`inline-block ${className}`}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ maxWidth: '100%', height: 'auto' }}
      >
        {/* Fondo y plantilla */}
        {mode === 'auto' ? (
          <rect width={width} height={height} fill={palette.background} />
        ) : (
          renderTemplate(templateId, palette, width, height)
        )}

        {/* Título con márgenes seguros */}
        <g textAnchor="middle" dominantBaseline="middle">
          {titleLines.map((line, index) => (
            <text
              key={`title-${index}`}
              x={width / 2}
              y={height * 0.4 + (index - (titleLines.length - 1) / 2) * (titleSize + 8)}
              fill={palette.text}
              fontSize={titleSize}
              fontFamily="serif"
              fontWeight="bold"
              style={{ 
                textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
                letterSpacing: '1px'
              }}
            >
              {line}
            </text>
          ))}
        </g>

        {/* Separador con márgenes */}
        <line
          x1={margins.horizontal + width * 0.1}
          y1={height * 0.55}
          x2={width - margins.horizontal - width * 0.1}
          y2={height * 0.55}
          stroke={palette.text}
          strokeWidth="2"
          opacity="0.7"
        />

        {/* Autor con márgenes seguros */}
        <g textAnchor="middle" dominantBaseline="middle">
          {authorLines.map((line, index) => (
            <text
              key={`author-${index}`}
              x={width / 2}
              y={height * 0.65 + (index - (authorLines.length - 1) / 2) * (authorSize + 6)}
              fill={palette.text}
              fontSize={authorSize}
              fontFamily="sans-serif"
              fontWeight="300"
              style={{ 
                letterSpacing: '0.5px',
                opacity: 0.9
              }}
            >
              {line}
            </text>
          ))}
        </g>
      </svg>
    </div>
  );
};

export default CoverRenderer;