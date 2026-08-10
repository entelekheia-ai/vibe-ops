; Supplement to @tree-sitter-grammars/tree-sitter-markdown's own injections.scm, run beside it rather
; than instead of it — see src/injections.ts for the mechanism. The grammar's own query names `inline`,
; the node type a paragraph gets; a table cell gets `pipe_table_cell` instead, so the grammar's own
; query never delivers it and a link or code span written inside a table cell is invisible to anything
; reading only the declared layers. Measured 2026-08-10 over this repository's own tracked markdown: 93
; links across 19 files live only inside table cells.

((pipe_table_cell) @injection.content (#set! injection.language "markdown_inline"))
