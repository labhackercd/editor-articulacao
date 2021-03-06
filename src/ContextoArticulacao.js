/* Copyright 2017 Assembleia Legislativa de Minas Gerais
 *
 * This file is part of Editor-Articulacao.
 *
 * Editor-Articulacao is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, version 3.
 *
 * Editor-Articulacao is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Editor-Articulacao.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * Representa o contexto do usuário no editor de articulação.
 * Possui dois atributos: cursor, contendo o contexto no cursor,
 * e as permissões de alteração de dispositivo na seleção.
 */
class ContextoArticulacao {
    constructor(elementoArticulacao, dispositivo) {
        let cursor = {
            italico: dispositivo.tagName === 'I',
            desconhecido: false,
            titulo: false,
            capitulo: false,
            secao: false,
            subsecao: false,
            artigo: false,
            continuacao: false,
            paragrafo: false,
            inciso: false,
            alinea: false,
            item: false,
            raiz: false,
            elemento: dispositivo,
            get tipo() {
                return this.dispositivo ? this.dispositivo.getAttribute('data-tipo') : 'desconhecido';
            }
        };

        while (dispositivo && dispositivo !== elementoArticulacao && !dispositivo.hasAttribute('data-tipo')) {
            dispositivo = dispositivo.parentElement;
        }

        cursor.dispositivo = dispositivo !== elementoArticulacao ? dispositivo : null;

        while (dispositivo && dispositivo.getAttribute('data-tipo') === 'continuacao') {
            dispositivo = dispositivo.previousElementSibling;
            cursor.continuacao = true;
        }

        if (!dispositivo) {
            cursor.desconhecido = true;
        } else if (dispositivo === elementoArticulacao) {
            dispositivo.raiz = true;
        } else if (dispositivo.hasAttribute('data-tipo')) {
            cursor[dispositivo.getAttribute('data-tipo')] = true;
        } else {
            cursor.desconhecido = true;
        }

        let primeiroDoTipo, tipoAnterior;

        Object.defineProperty(cursor, 'primeiroDoTipo', {
            get: function() {
                if (primeiroDoTipo === undefined) {
                    primeiroDoTipo = dispositivo && verificarPrimeiroDoTipo(dispositivo);
                }

                return primeiroDoTipo;
            }
        });

        cursor.dispositivoAnterior = dispositivo && obterDispositivoAnterior(dispositivo, elementoArticulacao);
        cursor.tipoAnterior = cursor.dispositivoAnterior && cursor.dispositivoAnterior.getAttribute('data-tipo');

        let matches = Element.prototype.matches || Element.prototype.webkitMatchesSelector || Element.prototype.mozMatchesSelector || Element.prototype.msMatchesSelector || Element.prototype.onMatchesSelector || function() { return true; };

        function possuiAnterior(dispositivo, tipo) {
            /* Implementação falha/incompleta. Uma subseção deve existir depois de uma seção,
             * mas não deveria permitir capítulo + seção + artigo + capítulo + subseção.
             *
             * Cuidado pois esta implementação não pode ser cara!
             */
            return dispositivo && matches.call(dispositivo, 'p[data-tipo="' + tipo + '"] ~ *');
        }

        let anteriorAgrupador = cursor.tipoAnterior === 'titulo' || cursor.tipoAnterior === 'capitulo' || cursor.tipoAnterior === 'secao' || cursor.tipoAnterior === 'subsecao';

        let permissoes = {
            titulo: !anteriorAgrupador,
            capitulo: !anteriorAgrupador || cursor.tipoAnterior === 'titulo',
            get secao() {
                return (!anteriorAgrupador || cursor.tipoAnterior === 'capitulo') && possuiAnterior(cursor.dispositivo, 'capitulo');
            },
            get subsecao() {
                return (!anteriorAgrupador || cursor.tipoAnterior === 'secao') && possuiAnterior(cursor.dispositivo, 'secao');
            },
            artigo: true /*cursor.tipoAnterior !== 'titulo' - No manual de redação parlamentar da ALMG, dá a entender que o título é um agrupamento de capítulos, mas a constituição possui Art 1º. logo após o título.*/,
            continuacao: cursor.tipoAnterior === 'artigo' || cursor.continuacao,
            inciso: cursor.tipoAnterior && !anteriorAgrupador && (!cursor.artigo || (cursor.artigo && !cursor.primeiroDoTipo)),
            paragrafo: cursor.tipoAnterior && !anteriorAgrupador && (!cursor.artigo || (cursor.artigo && (!cursor.primeiroDoTipo || cursor.continuacao))),
            alinea: (cursor.inciso && !cursor.primeiroDoTipo) || cursor.tipoAnterior === 'inciso' || cursor.tipoAnterior === 'alinea' || cursor.tipoAnterior === 'item',
            item: (cursor.alinea && !cursor.primeiroDoTipo) || cursor.tipoAnterior === 'alinea' || cursor.tipoAnterior === 'item'
        };

        Object.defineProperty(this, 'cursor', { value: cursor });
        Object.defineProperty(this, 'permissoes', { value: permissoes });

        Object.freeze(this);
        Object.freeze(cursor);
        Object.freeze(permissoes);
    }

    comparar(obj2) {
        for (let i in this.cursor) {
            if (this.cursor[i] !== obj2.cursor[i]) {
                return true;
            }
        }

        for (let i in this.permissoes) {
            if (this.permissoes[i] !== obj2.permissoes[i]) {
                return true;
            }
        }

        return false;
    }

    /**
     * Determina se o contexto atual é válido.
     *
     * @returns {Boolean} Verdadeiro, se o contexto estiver válido.
     */
    get valido() {
        return this.permissoes[this.cursor.tipo];
    }
}

/**
 * Determina se o dispositivo é o primeiro do tipo.
 *
 * @param {Element} dispositivo
 * @returns {Boolean} Verdadeiro, se for o primeiro do tipo.
 */
function verificarPrimeiroDoTipo(dispositivo) {
    var tipo = dispositivo.getAttribute('data-tipo');

    if (!tipo) {
        return null;
    }

    while (tipo === 'continuacao') {
        dispositvo = dispositivo.previousElementSibling;
        tipo = dispositivo.getAttribute('data-tipo');
    }

    let pontosParagem = ({
        parte: [],
        livro: [],
        titulo: [],
        capitulo: ['titulo'],
        secao: ['capitulo', 'titulo'],
        subsecao: ['secao', 'capitulo', 'titulo'],
        artigo: [],
        paragrafo: ['artigo'],
        inciso: ['paragrafo', 'artigo'],
        alinea: ['inciso'],
        item: ['alinea']
    })[tipo].reduce((prev, item) => {
        prev[item] = true;
        return prev;
    }, {});

    for (let prev = dispositivo.previousElementSibling; prev; prev = prev.previousElementSibling) {
        let tipoAnterior = prev.getAttribute('data-tipo');

        if (tipoAnterior === tipo) {
            return false;
        } else if (pontosParagem[tipoAnterior]) {
            return true;
        }
    }

    return true;
}

/**
 * Obtém o tipo de dispositivo anterior.
 *
 * @param {Element} dispositivo
 * @returns {Element} Elemento do dispositivo anterior.
 */
function obterDispositivoAnterior(dispositivo, elementoArticulacao) {
    while (dispositivo && !dispositivo.hasAttribute('data-tipo') && dispositivo !== elementoArticulacao) {
        dispositivo = dispositivo.parentElement;
    }

    if (!dispositivo || dispositivo === elementoArticulacao) {
        return null;
    }

    for (let anterior = dispositivo.previousElementSibling; anterior; anterior = anterior.previousElementSibling) {
        if (anterior.hasAttribute('data-tipo')) {
            let tipo = anterior.getAttribute('data-tipo');

            if (tipo !== 'continuacao') {
                return anterior;
            }
        }
    }

    return null;
}

export default ContextoArticulacao;