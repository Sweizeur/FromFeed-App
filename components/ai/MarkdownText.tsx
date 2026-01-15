import React from 'react';
import { Text, TextStyle } from 'react-native';

interface MarkdownTextProps {
  text: string;
  style?: TextStyle;
}

/**
 * Composant qui parse et affiche le markdown basique (gras, italique)
 * Supporte:
 * - **text** ou __text__ pour le gras
 * - *text* ou _text_ pour l'italique
 * - ***text*** ou ___text___ pour gras + italique
 */
export default function MarkdownText({ text, style }: MarkdownTextProps) {
  // Parser récursif pour le markdown basique
  const parseMarkdown = (content: string, baseStyle?: TextStyle): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let key = 0;

    // Patterns dans l'ordre de priorité (du plus spécifique au moins spécifique)
    // On utilise une approche séquentielle pour éviter les chevauchements
    let remaining = content;
    let lastIndex = 0;

    // Fonction helper pour trouver le prochain match
    const findNextMatch = (str: string, startPos: number) => {
      const patterns = [
        { regex: /\*\*\*(.+?)\*\*\*/g, style: { fontWeight: 'bold' as const, fontStyle: 'italic' as const }, name: 'bold-italic-asterisk' },
        { regex: /___(.+?)___/g, style: { fontWeight: 'bold' as const, fontStyle: 'italic' as const }, name: 'bold-italic-underscore' },
        { regex: /\*\*(.+?)\*\*/g, style: { fontWeight: 'bold' as const }, name: 'bold-asterisk' },
        { regex: /__(.+?)__/g, style: { fontWeight: 'bold' as const }, name: 'bold-underscore' },
        { regex: /\*(.+?)\*/g, style: { fontStyle: 'italic' as const }, name: 'italic-asterisk' },
        { regex: /_(.+?)_/g, style: { fontStyle: 'italic' as const }, name: 'italic-underscore' },
      ];

      let earliestMatch: { index: number; length: number; text: string; style: TextStyle } | null = null;
      let earliestPattern: typeof patterns[0] | null = null;

      for (const pattern of patterns) {
        pattern.regex.lastIndex = startPos;
        const match = pattern.regex.exec(str);
        if (match && (!earliestMatch || match.index < earliestMatch.index)) {
          earliestMatch = {
            index: match.index,
            length: match[0].length,
            text: match[1],
            style: pattern.style,
          };
          earliestPattern = pattern;
        }
      }

      return earliestMatch ? { ...earliestMatch, pattern: earliestPattern! } : null;
    };

    while (lastIndex < remaining.length) {
      const match = findNextMatch(remaining, lastIndex);

      if (!match) {
        // Plus de matches, ajouter le reste du texte
        const rest = remaining.substring(lastIndex);
        if (rest) {
          parts.push(
            <Text key={key++} style={baseStyle || style}>
              {rest}
            </Text>
          );
        }
        break;
      }

      // Ajouter le texte avant le match
      if (match.index > lastIndex) {
        const before = remaining.substring(lastIndex, match.index);
        if (before) {
          parts.push(
            <Text key={key++} style={baseStyle || style}>
              {before}
            </Text>
          );
        }
      }

      // Ajouter le texte formaté
      parts.push(
        <Text key={key++} style={[baseStyle || style, match.style]}>
          {match.text}
        </Text>
      );

      lastIndex = match.index + match.length;
    }

    // Si aucun match trouvé, retourner le texte tel quel
    if (parts.length === 0) {
      return [
        <Text key={0} style={baseStyle || style}>
          {content}
        </Text>,
      ];
    }

    return parts;
  };

  const parsedContent = parseMarkdown(text);
  
  // Wrapper dans un Text parent pour permettre l'imbrication
  return <Text style={style}>{parsedContent}</Text>;
}
