// Copyright 2025 Mykhailo Stetsiuk
// SPDX-License-Identifier: Apache-2.0

parser grammar SkryptParser;
options {
    language    = TypeScript;
    tokenVocab  = SkryptLexer;
}

lhs_chars   : Lhs_CHAR+ ;
rhs_chars   : Rhs_CHAR+ ;

option      : AT name=lhs_chars EQ value=lhs_chars ;
template    : PERCENT name=lhs_chars EQ value=expr ;
// https://github.com/antlr/antlr4/issues/77
ruleTr      : lhs ARROW rhs (QUESTION when=lhs_chars)? ;

lhs         : pattern (COMMA LF? pattern)* ;
pattern     : start=SLASH?
              (LBRACKET pre=expr RBRACKET)?
              inner=expr
              (LBRACKET post=expr RBRACKET)?
              end=SLASH?
              ;
expr        : term+             # Terms
            | l=expr BAR r=expr # Or
            ;
term        : LPAREN expr RPAREN                    # Group
            | TILDE term                            # Not
            | term q=(QUESTION | PLUS | ASTERISK)   # Quantification
            | LT lhs_chars GT                       # OrGroup
            | LBRACE lhs_chars RBRACE               # Substitution
            | UNDERSCORE                            # AnyLetter
            | lhs_chars                             # LhsString
            ;

rhs         : VOID      # Nothing
            | rhs_chars # RhsString
            ;

file        : line* EOF ;
line        : statement LF?
            | LF
            ;
statement   : option | template | ruleTr ;
