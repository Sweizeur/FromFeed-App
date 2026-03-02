import React, { useMemo } from 'react';
import { StyleSheet, StyleProp, TextStyle } from 'react-native';
import Markdown, { MarkdownIt } from 'react-native-markdown-display';

interface MarkdownTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
}

export default function MarkdownText({ text, style }: MarkdownTextProps) {
  const flatStyle = StyleSheet.flatten(style) || {};

  const mdStyles = useMemo(
    () =>
      StyleSheet.create({
        body: { ...flatStyle, margin: 0, padding: 0 },
        paragraph: { marginTop: 0, marginBottom: 4 },
        heading1: { ...flatStyle, fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
        heading2: { ...flatStyle, fontSize: 20, fontWeight: 'bold', marginBottom: 6 },
        heading3: { ...flatStyle, fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
        heading4: { ...flatStyle, fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
        heading5: { ...flatStyle, fontSize: 15, fontWeight: 'bold', marginBottom: 2 },
        heading6: { ...flatStyle, fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
        strong: { fontWeight: 'bold' },
        em: { fontStyle: 'italic' },
        link: { textDecorationLine: 'none' },
        blockquote: {
          borderLeftWidth: 3,
          borderLeftColor: '#ccc',
          paddingLeft: 10,
          marginVertical: 4,
          opacity: 0.85,
        },
        code_inline: {
          backgroundColor: 'rgba(128,128,128,0.15)',
          borderRadius: 4,
          paddingHorizontal: 4,
          fontFamily: 'Menlo',
          fontSize: (flatStyle.fontSize ?? 15) - 1,
        },
        code_block: {
          backgroundColor: 'rgba(128,128,128,0.12)',
          borderRadius: 8,
          padding: 10,
          fontFamily: 'Menlo',
          fontSize: (flatStyle.fontSize ?? 15) - 1,
          marginVertical: 4,
        },
        fence: {
          backgroundColor: 'rgba(128,128,128,0.12)',
          borderRadius: 8,
          padding: 10,
          fontFamily: 'Menlo',
          fontSize: (flatStyle.fontSize ?? 15) - 1,
          marginVertical: 4,
        },
        bullet_list: { marginVertical: 4 },
        ordered_list: { marginVertical: 4 },
        list_item: { flexDirection: 'row', marginBottom: 2 },
        hr: {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: '#ccc',
          marginVertical: 8,
        },
        table: { borderWidth: 1, borderColor: '#ccc', borderRadius: 4, marginVertical: 4 },
        thead: { backgroundColor: 'rgba(128,128,128,0.1)' },
        th: { padding: 6, fontWeight: 'bold' },
        td: { padding: 6 },
        tr: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ccc' },
      }),
    [JSON.stringify(flatStyle)],
  );

  const markdownIt = useMemo(
    () =>
      MarkdownIt({ typographer: true, html: false, linkify: false }).disable([
        'link',
        'image',
        'html_inline',
        'html_block',
      ]),
    [],
  );

  return (
    <Markdown
      style={mdStyles}
      markdownit={markdownIt}
      onLinkPress={() => false}
    >
      {text}
    </Markdown>
  );
}
