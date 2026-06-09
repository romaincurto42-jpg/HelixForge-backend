// ============================================================================
// strict_parser_godmode.js – Compilateur SDF Strict v2.0.0 (grammaire étendue)
// ============================================================================
// 
// Mission : transformer un prompt géométrique en pipeline SDF 100% déterministe.
// 
// Supporte :
// - Primitives avec paramètres nommés obligatoires
// - Opérateurs booléens : infixes (A union B) ET fonctionnels (union(A,B))
// - Transformations : suffixe (shape translate(...)) ET fonctionnelle (translate(..., shape))
// - Expressions arithmétiques, unités, etc.
// 
// Zéro interprétation, zéro heuristique, zéro comportement aléatoire.
// ============================================================================

// ----------------------------------------------------------------------------
// 1. Lexer (tokenisation)
// ----------------------------------------------------------------------------
const TokenType = {
    // Primitives
    SPHERE: 'SPHERE', BOX: 'BOX', CYLINDER: 'CYLINDER', CONE: 'CONE',
    TORUS: 'TORUS', CAPSULE: 'CAPSULE', PLANE: 'PLANE', ELLIPSOID: 'ELLIPSOID',
    PYRAMID: 'PYRAMID',
    // Opérations booléennes
    UNION: 'UNION', SUBTRACT: 'SUBTRACT', INTERSECT: 'INTERSECT',
    SMOOTH_UNION: 'SMOOTH_UNION', SMOOTH_SUBTRACT: 'SMOOTH_SUBTRACT', SMOOTH_INTERSECT: 'SMOOTH_INTERSECT',
    // Transformations
    TRANSLATE: 'TRANSLATE', ROTATE: 'ROTATE', SCALE: 'SCALE',
    MIRROR: 'MIRROR', REPEAT: 'REPEAT', ELONGATE: 'ELONGATE',
    ROUND: 'ROUND', TWIST: 'TWIST', BEND: 'BEND',
    // Valeurs
    NUMBER: 'NUMBER', UNIT: 'UNIT', IDENT: 'IDENT',
    // Opérateurs arithmétiques
    PLUS: 'PLUS', MINUS: 'MINUS', STAR: 'STAR', SLASH: 'SLASH',
    // Ponctuation
    LPAREN: 'LPAREN', RPAREN: 'RPAREN', COMMA: 'COMMA', EQUALS: 'EQUALS',
    EOF: 'EOF'
};

class Token {
    constructor(type, value, line, col) {
        this.type = type;
        this.value = value;
        this.line = line;
        this.col = col;
    }
}

class Lexer {
    constructor(source) {
        this.source = source;
        this.pos = 0;
        this.line = 1;
        this.col = 1;
    }

    tokenize() {
        const tokens = [];
        while (this.pos < this.source.length) {
            const ch = this.source[this.pos];
            // espaces
            if (/\s/.test(ch)) {
                if (ch === '\n') { this.line++; this.col = 1; } else { this.col++; }
                this.pos++;
                continue;
            }
            // nombres
            if (/\d/.test(ch) || (ch === '.' && /\d/.test(this.source[this.pos+1]))) {
                tokens.push(this.readNumber());
                continue;
            }
            // identifiants / mots-clés
            if (/[a-zA-Z_]/.test(ch)) {
                tokens.push(this.readIdentOrKeyword());
                continue;
            }
            // ponctuation
            switch (ch) {
                case '(': tokens.push(new Token(TokenType.LPAREN, '(', this.line, this.col)); break;
                case ')': tokens.push(new Token(TokenType.RPAREN, ')', this.line, this.col)); break;
                case ',': tokens.push(new Token(TokenType.COMMA, ',', this.line, this.col)); break;
                case '=': tokens.push(new Token(TokenType.EQUALS, '=', this.line, this.col)); break;
                case '+': tokens.push(new Token(TokenType.PLUS, '+', this.line, this.col)); break;
                case '-': tokens.push(new Token(TokenType.MINUS, '-', this.line, this.col)); break;
                case '*': tokens.push(new Token(TokenType.STAR, '*', this.line, this.col)); break;
                case '/': tokens.push(new Token(TokenType.SLASH, '/', this.line, this.col)); break;
                default:
                    throw new Error(`Caractère inattendu '${ch}' à la ligne ${this.line}, col ${this.col}`);
            }
            this.pos++; this.col++;
        }
        tokens.push(new Token(TokenType.EOF, null, this.line, this.col));
        return tokens;
    }

    readNumber() {
        const startCol = this.col;
        let numStr = '';
        let hasDecimal = false;
        while (this.pos < this.source.length && /[\d\.]/.test(this.source[this.pos])) {
            if (this.source[this.pos] === '.') {
                if (hasDecimal) break;
                hasDecimal = true;
            }
            numStr += this.source[this.pos];
            this.pos++;
            this.col++;
        }
        let value = parseFloat(numStr);
        let unit = null;
        const unitMatch = this.source.slice(this.pos).match(/^(mm|cm|m|in|ft|deg|rad)/);
        if (unitMatch) {
            unit = unitMatch[0];
            this.pos += unit.length;
            this.col += unit.length;
        }
        const token = new Token(TokenType.NUMBER, value, this.line, startCol);
        if (unit) token.unit = unit;
        return token;
    }

    readIdentOrKeyword() {
        const startCol = this.col;
        let ident = '';
        while (this.pos < this.source.length && /[a-zA-Z0-9_]/.test(this.source[this.pos])) {
            ident += this.source[this.pos];
            this.pos++;
            this.col++;
        }
        const keywordMap = {
            sphere: TokenType.SPHERE, box: TokenType.BOX, cylinder: TokenType.CYLINDER,
            cone: TokenType.CONE, torus: TokenType.TORUS, capsule: TokenType.CAPSULE,
            plane: TokenType.PLANE, ellipsoid: TokenType.ELLIPSOID, pyramid: TokenType.PYRAMID,
            union: TokenType.UNION, subtract: TokenType.SUBTRACT, intersect: TokenType.INTERSECT,
            smoothUnion: TokenType.SMOOTH_UNION, smoothSubtract: TokenType.SMOOTH_SUBTRACT,
            smoothIntersect: TokenType.SMOOTH_INTERSECT,
            translate: TokenType.TRANSLATE, rotate: TokenType.ROTATE, scale: TokenType.SCALE,
            mirror: TokenType.MIRROR, repeat: TokenType.REPEAT, elongate: TokenType.ELONGATE,
            round: TokenType.ROUND, twist: TokenType.TWIST, bend: TokenType.BEND
        };
        const type = keywordMap[ident] || TokenType.IDENT;
        return new Token(type, ident, this.line, startCol);
    }
}

// ----------------------------------------------------------------------------
// 2. Parser (AST) – version étendue
// ----------------------------------------------------------------------------
class ASTNode {
    constructor(type) { this.type = type; }
}

class PrimitiveNode extends ASTNode {
    constructor(primitiveType, params) {
        super('Primitive');
        this.primitiveType = primitiveType;
        this.params = params;
    }
}

class TransformNode extends ASTNode {
    constructor(transformType, args, child = null) {
        super('Transform');
        this.transformType = transformType;
        this.args = args;
        this.child = child;
    }
}

class BinaryOpNode extends ASTNode {
    constructor(op, left, right) {
        super('BinaryOp');
        this.op = op;
        this.left = left;
        this.right = right;
    }
}

class NumberNode extends ASTNode {
    constructor(value, unit) {
        super('Number');
        this.value = value;
        this.unit = unit || null;
    }
}

class FunctionCallNode extends ASTNode {
    constructor(func, args) {
        super('FunctionCall');
        this.func = func;
        this.args = args;
    }
}

class Parser {
    constructor(tokens) {
        this.tokens = tokens;
        this.pos = 0;
    }

    peek() { return this.tokens[this.pos]; }
    consume() { return this.tokens[this.pos++]; }
    match(type) {
        if (this.peek().type === type) {
            return this.consume();
        }
        return null;
    }
    expect(type, msg) {
        const token = this.peek();
        if (token.type !== type) {
            throw new Error(msg || `Attendu ${type}, obtenu ${token.type} à la ligne ${token.line}`);
        }
        return this.consume();
    }

    parse() {
        return this.parseExpression();
    }

    parseExpression() {
        let left = this.parsePrimaryWithTransforms();
        while (true) {
            const op = this.peek().type;
            if (op === TokenType.UNION || op === TokenType.SUBTRACT || op === TokenType.INTERSECT ||
                op === TokenType.SMOOTH_UNION || op === TokenType.SMOOTH_SUBTRACT || op === TokenType.SMOOTH_INTERSECT) {
                this.consume();
                const right = this.parsePrimaryWithTransforms();
                left = new BinaryOpNode(op, left, right);
            } else {
                break;
            }
        }
        return left;
    }

    parsePrimaryWithTransforms() {
        let node = this.parseAtomic();
        while (this.isTransform(this.peek().type)) {
            const transToken = this.consume();
            const transNode = this.parseTransform(transToken.type);
            transNode.child = node;
            node = transNode;
        }
        return node;
    }

    parseAtomic() {
        const token = this.peek();
        // 1. primitive
        if (this.isPrimitive(token.type)) {
            this.consume();
            return this.parsePrimitive(token.type);
        }
        // 2. parenthèse
        if (token.type === TokenType.LPAREN) {
            this.consume();
            const expr = this.parseExpression();
            this.expect(TokenType.RPAREN, "')' manquante");
            return expr;
        }
        // 3. opérateur binaire fonctionnel : union(A,B) etc.
        if (this.isBinaryOp(token.type) && this.tokens[this.pos+1]?.type === TokenType.LPAREN) {
            const op = this.consume();
            this.expect(TokenType.LPAREN, "'(' attendue");
            const left = this.parseExpression();
            this.expect(TokenType.COMMA, "',' attendue");
            const right = this.parseExpression();
            this.expect(TokenType.RPAREN, "')' manquante");
            return new BinaryOpNode(op.type, left, right);
        }
        // 4. transformation fonctionnelle : translate(x,y,z, shape) etc.
        if (this.isTransform(token.type) && this.tokens[this.pos+1]?.type === TokenType.LPAREN) {
            const transType = this.consume().type;
            this.expect(TokenType.LPAREN, "'(' attendue");
            const args = [];
            // On parse les arguments jusqu'à la parenthèse fermante
            while (this.peek().type !== TokenType.RPAREN) {
                if (this.peek().type === TokenType.IDENT && this.tokens[this.pos+1]?.type === TokenType.EQUALS) {
                    const ident = this.consume();
                    this.expect(TokenType.EQUALS);
                    const expr = this.parseExpressionValue();
                    args.push({ name: ident.value, value: expr });
                } else {
                    const expr = this.parseExpressionValue();
                    args.push({ value: expr });
                }
                if (this.peek().type === TokenType.COMMA) this.consume();
                else break;
            }
            this.expect(TokenType.RPAREN, "')' manquante");
            // Détecter si le dernier argument est une forme (shape) – si ce n'est pas un nombre simple
            let child = null;
            if (args.length > 0) {
                const last = args[args.length-1];
                if (last.value && !(last.value instanceof NumberNode) && !(last.value instanceof ASTNode && last.value.type === 'Number')) {
                    child = last.value;
                    args.pop();
                }
            }
            const transNode = new TransformNode(transType, args, child);
            return transNode;
        }
        throw new Error(`Expression primaire inattendue: ${token.type} à la ligne ${token.line}`);
    }

    isPrimitive(type) {
        return [
            TokenType.SPHERE, TokenType.BOX, TokenType.CYLINDER, TokenType.CONE,
            TokenType.TORUS, TokenType.CAPSULE, TokenType.PLANE, TokenType.ELLIPSOID,
            TokenType.PYRAMID
        ].includes(type);
    }

    isTransform(type) {
        return [
            TokenType.TRANSLATE, TokenType.ROTATE, TokenType.SCALE, TokenType.MIRROR,
            TokenType.REPEAT, TokenType.ELONGATE, TokenType.ROUND, TokenType.TWIST, TokenType.BEND
        ].includes(type);
    }

    isBinaryOp(type) {
        return [
            TokenType.UNION, TokenType.SUBTRACT, TokenType.INTERSECT,
            TokenType.SMOOTH_UNION, TokenType.SMOOTH_SUBTRACT, TokenType.SMOOTH_INTERSECT
        ].includes(type);
    }

    parsePrimitive(primType) {
        this.expect(TokenType.LPAREN, `'(' attendue après ${primType}`);
        const params = new Map();
        while (this.peek().type !== TokenType.RPAREN) {
            const ident = this.expect(TokenType.IDENT, "Nom du paramètre attendu");
            this.expect(TokenType.EQUALS, "'=' attendu");
            const expr = this.parseExpressionValue();
            params.set(ident.value, expr);
            if (this.peek().type === TokenType.COMMA) {
                this.consume();
            } else break;
        }
        this.expect(TokenType.RPAREN, "')' manquante pour primitive");
        return new PrimitiveNode(primType, params);
    }

    parseTransform(transType) {
        // Version suffixe : shape transform(args)
        this.expect(TokenType.LPAREN, `'(' attendue après ${transType}`);
        const args = [];
        while (this.peek().type !== TokenType.RPAREN) {
            if (this.peek().type === TokenType.IDENT && this.tokens[this.pos+1]?.type === TokenType.EQUALS) {
                const ident = this.consume();
                this.consume(); // '='
                const expr = this.parseExpressionValue();
                args.push({ name: ident.value, value: expr });
            } else {
                const expr = this.parseExpressionValue();
                args.push({ value: expr });
            }
            if (this.peek().type === TokenType.COMMA) this.consume();
            else break;
        }
        this.expect(TokenType.RPAREN, "')' manquante pour transformation");
        return new TransformNode(transType, args);
    }

    parseExpressionValue() {
        let node = this.parseTerm();
        while (this.peek().type === TokenType.PLUS || this.peek().type === TokenType.MINUS) {
            const op = this.consume().type;
            const right = this.parseTerm();
            node = new BinaryOpNode(op, node, right);
        }
        return node;
    }

    parseTerm() {
        let node = this.parseFactor();
        while (this.peek().type === TokenType.STAR || this.peek().type === TokenType.SLASH) {
            const op = this.consume().type;
            const right = this.parseFactor();
            node = new BinaryOpNode(op, node, right);
        }
        return node;
    }

    parseFactor() {
        const token = this.peek();
        if (token.type === TokenType.NUMBER) {
            this.consume();
            return new NumberNode(token.value, token.unit);
        }
        if (token.type === TokenType.LPAREN) {
            this.consume();
            const expr = this.parseExpressionValue();
            this.expect(TokenType.RPAREN, "')' manquante");
            return expr;
        }
        if (token.type === TokenType.IDENT && this.tokens[this.pos+1]?.type === TokenType.LPAREN) {
            const funcName = this.consume().value;
            this.expect(TokenType.LPAREN, "'(' attendue");
            const arg = this.parseExpressionValue();
            this.expect(TokenType.RPAREN, "')' manquante");
            return new FunctionCallNode(funcName, [arg]);
        }
        throw new Error(`Facteur inattendu: ${token.type}`);
    }
}

// ----------------------------------------------------------------------------
// 3. Analyse sémantique (CORRIGÉE pour BOX)
// ----------------------------------------------------------------------------
class SemanticAnalyzer {
    constructor() {
        this.errors = [];
    }

    analyze(node) {
        this.visit(node);
        return this.errors;
    }

    visit(node) {
        const method = `visit${node.type}`;
        if (this[method]) {
            this[method](node);
        } else {
            for (const key in node) {
                if (node[key] && typeof node[key] === 'object') {
                    this.visit(node[key]);
                }
            }
        }
    }

    visitPrimitive(node) {
        // Cas spécial pour BOX : soit 'size' soit les trois dimensions
        if (node.primitiveType === TokenType.BOX) {
            const hasSize = node.params.has('size');
            const hasWidth = node.params.has('width');
            const hasHeight = node.params.has('height');
            const hasDepth = node.params.has('depth');
            if (hasSize && (hasWidth || hasHeight || hasDepth)) {
                this.errors.push(`BOX ne peut pas avoir 'size' et ('width'/'height'/'depth') en même temps.`);
            } else if (hasSize) {
                const val = this.evaluateConstant(node.params.get('size'));
                if (val !== null && typeof val !== 'number') {
                    this.errors.push(`Le paramètre 'size' de BOX doit être un nombre.`);
                }
            } else if (hasWidth && hasHeight && hasDepth) {
                const w = this.evaluateConstant(node.params.get('width'));
                const h = this.evaluateConstant(node.params.get('height'));
                const d = this.evaluateConstant(node.params.get('depth'));
                if (w !== null && typeof w !== 'number') this.errors.push(`width doit être un nombre`);
                if (h !== null && typeof h !== 'number') this.errors.push(`height doit être un nombre`);
                if (d !== null && typeof d !== 'number') this.errors.push(`depth doit être un nombre`);
            } else {
                this.errors.push(`BOX doit avoir soit 'size' soit ('width', 'height', 'depth')`);
            }
            for (let [name, expr] of node.params) {
                if (!['size', 'width', 'height', 'depth'].includes(name)) {
                    this.errors.push(`Paramètre inconnu '${name}' pour BOX`);
                }
            }
            return;
        }

        // Autres primitives
        const expectedParams = this.getExpectedParams(node.primitiveType);
        for (let [name, expr] of node.params) {
            if (!expectedParams.has(name)) {
                this.errors.push(`Paramètre inconnu '${name}' pour ${node.primitiveType}`);
            }
            const val = this.evaluateConstant(expr);
            if (val !== null && typeof val !== 'number') {
                this.errors.push(`Le paramètre '${name}' doit être un nombre, reçu ${typeof val}`);
            }
        }
        for (let required of expectedParams.keys()) {
            if (!node.params.has(required)) {
                this.errors.push(`Paramètre obligatoire '${required}' manquant pour ${node.primitiveType}`);
            }
        }
    }

    visitTransform(node) {
        const spec = this.getTransformSpec(node.transformType);
        if (spec.arity === 'named') {
            const provided = new Set(node.args.map(a => a.name));
            for (let required of spec.required) {
                if (!provided.has(required)) {
                    this.errors.push(`Paramètre '${required}' manquant pour ${node.transformType}`);
                }
            }
        } else {
            if (node.args.length !== spec.arity) {
                this.errors.push(`La transformation ${node.transformType} attend ${spec.arity} arguments, reçu ${node.args.length}`);
            }
        }
        if (node.transformType === TokenType.ROTATE) {
            const angleArg = node.args.find(a => a.name === 'angle' || (a.name === undefined && a.value));
            if (angleArg && angleArg.value && angleArg.value.unit) {
                const unit = angleArg.value.unit;
                if (unit !== 'deg' && unit !== 'rad') {
                    this.errors.push(`L'angle de rotation doit être en deg (deg) ou rad (rad), reçu '${unit}'`);
                }
            }
        }
        if (node.child) this.visit(node.child);
    }

    visitBinaryOp(node) {
        this.visit(node.left);
        this.visit(node.right);
    }

    getExpectedParams(primType) {
        const map = new Map();
        switch (primType) {
            case TokenType.SPHERE: map.set('r', true); break;
            case TokenType.CYLINDER: map.set('r', true); map.set('height', true); break;
            case TokenType.CONE: map.set('r', true); map.set('height', true); break;
            case TokenType.TORUS: map.set('r', true); map.set('radius', true); break;
            case TokenType.CAPSULE: map.set('r', true); map.set('height', true); break;
            case TokenType.PLANE: map.set('size', true); break;
            case TokenType.ELLIPSOID: map.set('rx', true); map.set('ry', true); map.set('rz', true); break;
            case TokenType.PYRAMID: map.set('size', true); map.set('height', true); break;
            default: break;
        }
        return map;
    }

    getTransformSpec(transType) {
        const specs = {
            [TokenType.TRANSLATE]: { arity: 3, required: [] },
            [TokenType.ROTATE]: { arity: 'named', required: ['angle', 'axis'] },
            [TokenType.SCALE]: { arity: 3, required: [] },
            [TokenType.MIRROR]: { arity: 1, required: [] },
            [TokenType.REPEAT]: { arity: 3, required: [] },
            [TokenType.ELONGATE]: { arity: 3, required: [] },
            [TokenType.ROUND]: { arity: 1, required: [] },
            [TokenType.TWIST]: { arity: 2, required: [] },
            [TokenType.BEND]: { arity: 2, required: [] },
        };
        return specs[transType] || { arity: 0, required: [] };
    }

    evaluateConstant(expr) {
        if (expr instanceof NumberNode) return expr.value;
        if (expr.type === 'BinaryOp') {
            const left = this.evaluateConstant(expr.left);
            const right = this.evaluateConstant(expr.right);
            if (left !== null && right !== null) {
                switch (expr.op) {
                    case TokenType.PLUS: return left + right;
                    case TokenType.MINUS: return left - right;
                    case TokenType.STAR: return left * right;
                    case TokenType.SLASH: return left / right;
                }
            }
        }
        if (expr.type === 'FunctionCall') {
            if (expr.func === 'sin') return Math.sin(this.evaluateConstant(expr.args[0]));
            if (expr.func === 'cos') return Math.cos(this.evaluateConstant(expr.args[0]));
        }
        return null;
    }
}

// ----------------------------------------------------------------------------
// 4. Conversion vers le format graphique HF3 (MODIFIÉ : EXPOSE rootId)
// ----------------------------------------------------------------------------
class HF3GraphConverter {
    constructor() {
        this.nodeCounter = 0;
        this.nodes = [];
        this.idMap = new Map();
    }

    convert(ast) {
        console.log("[HF3GraphConverter] Conversion start");
        this.nodeCounter = 0;
        this.nodes = [];
        this.idMap.clear();
        const rootId = this.convertNode(ast);
        console.log("[HF3GraphConverter] rootId =", rootId);
        const rootNode = this.nodes.find(n => n.id === rootId);
        let rootObj;
        if (rootNode && rootNode.type === 'op') {
            rootObj = {
                type: 'op',
                op: rootNode.op,
                left: rootNode.left,
                right: rootNode.right
            };
        } else {
            rootObj = { id: rootId };
        }
        const result = { root: rootObj, nodes: this.nodes, rootId: rootId }; // AJOUT DE rootId
        console.log("[HF3GraphConverter] Conversion done, nodes count:", this.nodes.length);
        return result;
    }

    convertNode(node) {
        console.log("[convertNode] type:", node.type);
        if (node.type === 'Primitive') {
            return this.convertPrimitive(node);
        } else if (node.type === 'Transform') {
            return this.convertTransform(node);
        } else if (node.type === 'BinaryOp') {
            return this.convertBinaryOp(node);
        } else if (node.type === 'FunctionCall') {
            console.warn("[convertNode] FunctionCallNode non supporté nativement, conversion en valeur constante");
            const value = this.evaluateNumber(node);
            console.log("[convertNode] FunctionCall évalué à", value);
            const fakeNumberNode = new NumberNode(value, null);
            return this.convertPrimitiveNumber(fakeNumberNode);
        } else {
            console.error("[convertNode] Type non supporté:", node.type);
            throw new Error(`Type de nœud non supporté pour conversion: ${node.type}`);
        }
    }

    convertPrimitiveNumber(numNode) {
        const id = this.newId();
        this.nodes.push({ id, type: 'constant', value: numNode.value });
        return id;
    }

    convertPrimitive(prim) {
        const kind = this.tokenTypeToName(prim.primitiveType);
        const params = {};
        for (let [key, val] of prim.params) {
            params[key] = this.evaluateNumber(val);
        }
        const id = this.newId();
        const nodeObj = { id, type: kind, ...params };
        this.nodes.push(nodeObj);
        this.idMap.set(prim, id);
        return id;
    }

    convertTransform(trans) {
        const childId = this.convertNode(trans.child);
        const kind = this.tokenTypeToName(trans.transformType);
        const args = trans.args.map(arg => {
            if (arg.value) return this.evaluateNumber(arg.value);
            if (arg.name && arg.value) return { name: arg.name, value: this.evaluateNumber(arg.value) };
            return arg;
        });
        let transformNode;
        if (kind === 'translate') {
            const [tx, ty, tz] = args;
            const childNode = this.nodes.find(n => n.id === childId);
            if (childNode) {
                childNode.translate = [tx, ty, tz];
            }
            return childId;
        } else if (kind === 'rotate' || kind === 'scale') {
            const id = this.newId();
            transformNode = { id, type: 'transform', kind, args, child: { id: childId } };
            this.nodes.push(transformNode);
            this.idMap.set(trans, id);
            return id;
        } else {
            const id = this.newId();
            transformNode = { id, type: 'transform', kind, args, child: { id: childId } };
            this.nodes.push(transformNode);
            this.idMap.set(trans, id);
            return id;
        }
    }

    convertBinaryOp(bin) {
        const leftId = this.convertNode(bin.left);
        const rightId = this.convertNode(bin.right);
        const op = this.tokenTypeToName(bin.op);
        const id = this.newId();
        const opNode = {
            id,
            type: 'op',
            op: op,
            left: { id: leftId },
            right: { id: rightId }
        };
        this.nodes.push(opNode);
        this.idMap.set(bin, id);
        return id;
    }

    tokenTypeToName(type) {
        const names = {
            [TokenType.SPHERE]: 'sphere', [TokenType.BOX]: 'box', [TokenType.CYLINDER]: 'cylinder',
            [TokenType.CONE]: 'cone', [TokenType.TORUS]: 'torus', [TokenType.CAPSULE]: 'capsule',
            [TokenType.PLANE]: 'plane', [TokenType.ELLIPSOID]: 'ellipsoid', [TokenType.PYRAMID]: 'pyramid',
            [TokenType.UNION]: 'union', [TokenType.SUBTRACT]: 'subtract', [TokenType.INTERSECT]: 'intersect',
            [TokenType.SMOOTH_UNION]: 'smooth_union', [TokenType.SMOOTH_SUBTRACT]: 'smooth_subtract',
            [TokenType.SMOOTH_INTERSECT]: 'smooth_intersect',
            [TokenType.TRANSLATE]: 'translate', [TokenType.ROTATE]: 'rotate', [TokenType.SCALE]: 'scale',
            [TokenType.MIRROR]: 'mirror', [TokenType.REPEAT]: 'repeat', [TokenType.ELONGATE]: 'elongate',
            [TokenType.ROUND]: 'round', [TokenType.TWIST]: 'twist', [TokenType.BEND]: 'bend'
        };
        return names[type] || 'unknown';
    }

    evaluateNumber(expr) {
        if (expr instanceof NumberNode) {
            let val = expr.value;
            if (expr.unit === 'cm') val *= 0.01;
            else if (expr.unit === 'mm') val *= 0.001;
            else if (expr.unit === 'deg') val *= Math.PI / 180;
            return val;
        }
        if (expr.type === 'BinaryOp') {
            const left = this.evaluateNumber(expr.left);
            const right = this.evaluateNumber(expr.right);
            switch (expr.op) {
                case TokenType.PLUS: return left + right;
                case TokenType.MINUS: return left - right;
                case TokenType.STAR: return left * right;
                case TokenType.SLASH: return left / right;
                default: return 0;
            }
        }
        if (expr.type === 'FunctionCall') {
            if (expr.func === 'sin') return Math.sin(this.evaluateNumber(expr.args[0]));
            if (expr.func === 'cos') return Math.cos(this.evaluateNumber(expr.args[0]));
            console.warn("[evaluateNumber] Fonction non reconnue:", expr.func);
            return 0;
        }
        return 0;
    }

    newId() {
        return `n${++this.nodeCounter}`;
    }
}

// ----------------------------------------------------------------------------
// 5. API Publique – parseStrict (format HF3) avec logs de debug
// ----------------------------------------------------------------------------
function parseStrict(source) {
    console.log("[parseStrict] Début, source length:", source.length, "preview:", source.substring(0, 100));
    try {
        console.log("[parseStrict] Tokenisation...");
        const lexer = new Lexer(source);
        const tokens = lexer.tokenize();
        console.log("[parseStrict] Tokens générés:", tokens.length);

        console.log("[parseStrict] Parsing...");
        const parser = new Parser(tokens);
        const ast = parser.parse();
        console.log("[parseStrict] AST construit, type racine:", ast.type);

        console.log("[parseStrict] Analyse sémantique...");
        const semantic = new SemanticAnalyzer();
        const errors = semantic.analyze(ast);
        if (errors.length > 0) {
            console.error("[parseStrict] Erreurs sémantiques:", errors);
            return {
                success: false,
                mode: "strict",
                graph: null,
                error: errors.join("; ")
            };
        }
        console.log("[parseStrict] Pas d'erreur sémantique");

        console.log("[parseStrict] Conversion graph...");
        const converter = new HF3GraphConverter();
        const graph = converter.convert(ast);
        console.log("[parseStrict] Graph converti, root:", graph.root, "nodes:", graph.nodes.length, "rootId:", graph.rootId);

        return {
            success: true,
            mode: "strict",
            graph: graph,
            rootId: graph.rootId, // EXPOSER rootId DIRECTEMENT
            error: null
        };
    } catch (err) {
        console.error("[parseStrict] EXCEPTION attrapée:", err.message);
        console.error(err.stack);
        return {
            success: false,
            mode: "strict",
            graph: null,
            error: err.message
        };
    }
}

module.exports = { parseStrict };
