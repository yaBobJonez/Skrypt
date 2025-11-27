// Copyright 2025 Mykhailo Stetsiuk
// SPDX-License-Identifier: Apache-2.0

lexer grammar SkryptLexer;
options {
    language    = TypeScript;
}

COMMENT         : '#' ~[\n]*    -> channel(HIDDEN) ;

BANG            : '!' ;
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

COLON           : ':' ;
SEMI            : ';' ;
COMMA           : ',' ;
CARET           : '^' ;
TILDE           : '~' ;
BAR             : '|' ;
HYPHEN          : '-' ;
SLASH           : '/' ;
UNDERSCORE      : '_' ;

QUESTION        : '?' ;
PLUS            : '+' ;
ASTERISK        : '*' ;
MULT            : '×' | '*=' ;

LF              : '\n'+ ;
WS              : [ \r\t]+      -> skip ;

DIGIT               : [0-9] ;
BACKTICK            : '`'       -> pushMode(String) ;
Lhs_CHAR            : '\\u' HEX HEX HEX HEX             // Leave
                    | '\\' [rntvdDsS0^$.(){}[\]|/?+*\\] // Leave
                    | '\\' .                            // Strip
                    | ~[&$.'"]                          // Leave
                    ;
fragment HEX        : [0-9a-fA-F] ;

mode String ;

String_BACKTICK : BACKTICK  -> type(BACKTICK), popMode ;
String_CHAR     : '\\' [rnt]            // Leave | Render
                | '\\`'                 // Strip
                | [.^$(){}[\]|/?+*\\]   // Escape | Leave
                | ~[\r\n]               // Leave
                ;

mode RHS ;

Rhs_COMMENT     : COMMENT   -> type(COMMENT) ;

Rhs_QUESTION    : QUESTION  -> type(QUESTION), mode(When) ;
VOID            : '{}' | '∅' ;

Rhs_LF          : LF        -> type(LF), mode(DEFAULT_MODE) ;
Rhs_WS          : WS        -> skip ;

Rhs_BACKTICK    : BACKTICK                  -> type(BACKTICK), pushMode(String) ;
Rhs_CHAR        : '\\u' HEX HEX HEX HEX     // Render
                | '\\' [rnt0\\]             // Render
                | '\\' .                    // Strip
                | ~[$'"]                    // Leave
                ;

mode When ;

When_COMMENT    : COMMENT   -> type(COMMENT) ;

When_LPAREN     : LPAREN    -> type(LPAREN) ;
When_RPAREN     : RPAREN    -> type(RPAREN) ;

When_TILDE      : TILDE     -> type(TILDE) ;
When_BAR        : BAR       -> type(BAR) ;
When_LT         : LT        -> type(LT) ;
When_GT         : GT        -> type(GT) ;
When_EQ         : EQ        -> type(EQ) ;
AMPERSAND       : '&' ;

When_LF         : LF        -> type(LF), mode(DEFAULT_MODE) ;
When_WS         : WS        -> skip ;

When_BACKTICK   : BACKTICK      -> type(BACKTICK), pushMode(String) ;
When_CHAR       : Lhs_CHAR      -> type(Lhs_CHAR) ;
