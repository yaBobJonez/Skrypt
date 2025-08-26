// Copyright 2025 Mykhailo Stetsiuk
// SPDX-License-Identifier: Apache-2.0

parser grammar SkryptParser;
options {
    language    = TypeScript;
    tokenVocab  = SkryptLexer;
}

lhs_chars   : BACKTICK String_CHAR* BACKTICK    # LhsRawString
            | chars+=(Lhs_CHAR | DIGIT)+        # LhsString
            ;
rhs_chars   : BACKTICK String_CHAR* BACKTICK    # RhsRawString
            | Rhs_CHAR+                         # RhsString
            ;
number      : DIGIT+ ;

directive   : BANG name=lhs_chars ( EQ values+=lhs_chars (COMMA values+=lhs_chars)* )? ;
option      : AT name=lhs_chars EQ value=lhs_chars ;
template    : PERCENT name=lhs_chars EQ value=expr ;
// https://github.com/antlr/antlr4/issues/77
ruleTr      : lhs ARROW rhs (QUESTION when)? ;
block       : (QUESTION when (COMMA expr)? COLON | expr COLON)
              line*
              SEMI;

lhs         : pattern (COMMA LF? pattern)* ;
pattern     : behind+=lookaround* inner=expr ahead+=lookaround* ;
lookaround  : SLASH | LBRACKET expr RBRACKET ;

expr        : term+             # Terms
            | l=expr BAR r=expr # Or
            ;
term        : LPAREN expr RPAREN                    # Group
            | l=term HYPHEN r=term                  # Difference
            | TILDE term                            # Not
            | term quantifier                       # Quantification
            | LT lhs_chars GT                       # OrGroup
            | LBRACE lhs_chars RBRACE               # Substitution
            | UNDERSCORE                            # AnyLetter
            | CARET                                 # Anchor
            | lhs_chars                             # LhsChars
            ;
quantifier  : (QUESTION | PLUS | ASTERISK)          # QuantSimple
            | MULT from=number HYPHEN to=number     # QuantNtoM
            | MULT number PLUS                      # QuantNOrMore
            | MULT number                           # QuantExactlyN
            ;

rhs         : VOID      # Nothing
            | rhs_chars # RhsChars
            ;

when        : LPAREN when RPAREN        # WhenGroup
            | TILDE when                # WhenNot
            | l=when AMPERSAND r=when   # WhenAnd
            | l=when BAR r=when         # WhenOr
            | lhs_chars                 # WhenChars
            ;

file        : line* EOF ;
line        : statement LF?
            | LF
            ;
statement   : directive | option | template | ruleTr | block;
