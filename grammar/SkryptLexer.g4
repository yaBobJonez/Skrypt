// Copyright 2025 Mykhailo Stetsiuk
// SPDX-License-Identifier: Apache-2.0

lexer grammar SkryptLexer;
options {
    language    = TypeScript;
}

COMMENT         : '#' ~[\n]*    -> channel(HIDDEN) ;

AT              : '@' ;
PERCENT         : '%' ;
EQ              : '=' ;

ARROW           : ('->' | '→')  -> mode(RHS);

LPAREN          : '(' ;
RPAREN          : ')' ;
LBRACKET        : '[' ;
RBRACKET        : ']' ;
LBRACE          : '{' ;
RBRACE          : '}' ;
LT              : '<' ;
GT              : '>' ;

COMMA           : ',' ;
TILDE           : '~' ;
BAR             : '|' ;
SLASH           : '/' ;
UNDERSCORE      : '_' ;

QUESTION        : '?' ;
PLUS            : '+' ;
ASTERISK        : '*' ;

LF              : '\n'+ ;
WS              : [ \r\t]+      -> skip ;

Lhs_CHAR        : '\\u' HEX HEX HEX HEX             // Leave
                | '\\' [rntvdDsS0(){}[\]|/?+*\-\\]  // Leave
                | '\\' ~[\r\n\t]                    // Strip
                | [.\-]                             // Escape
                | .                                 // Leave
                ;
fragment HEX    : [0-9a-fA-F] ;


mode RHS ;

Rhs_COMMENT     : COMMENT   -> type(COMMENT) ;

Rhs_QUESTION    : QUESTION  -> type(QUESTION), mode(DEFAULT_MODE) ;
VOID            : '{}' | '∅' ;

Rhs_LF          : LF        -> type(LF), mode(DEFAULT_MODE) ;
Rhs_WS          : WS        -> skip ;

Rhs_CHAR        : '\\u' HEX HEX HEX HEX     // Render
                | '\\' [rnt0\\]              // Render
                | '\\' ~[\r\n\t]            // Strip
                | .                         // Leave
                ;
