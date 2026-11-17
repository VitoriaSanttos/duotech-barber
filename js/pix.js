// =====================================================================
//  Pix "copia e cola" (BR Code do Banco Central) + QR Code
// =====================================================================
/*
 * PARA QUE SERVE ESTE ARQUIVO
 * ---------------------------
 * Gera o código Pix "copia e cola" e o desenho do QR Code, sem depender de
 * banco nem de servidor: tudo é calculado aqui no próprio aparelho.
 *
 * Onde aparece na tela:
 * - app/assinatura.js: QR Code para o studio pagar a assinatura do sistema.
 * - app/agenda.js e studio/studio.js: Pix do sinal que a cliente paga ao agendar.
 * - app/servicos.js e super/super.js: botão "testar meu Pix" (valor R$ 1,00).
 * Para desenhar o QR Code ele usa a biblioteca externa "qrcode-generator"
 * (carregada no HTML antes deste arquivo, ela cria window.qrcode).
 *
 * Como funciona o código Pix (padrão "BR Code" do Banco Central):
 * é um texto formado por vários "campos" colados um atrás do outro. Cada campo
 * tem 3 partes: ID (2 dígitos) + TAMANHO (2 dígitos) + VALOR.
 * Exemplo: campo '58' com valor 'BR' vira "5802BR" (id 58, tamanho 02, valor BR).
 * No final vem um "dígito verificador" (CRC16) que o app do banco usa para
 * conferir se o código não foi digitado/copiado errado.
 *
 * Conceitos que você aprende aqui:
 * - IIFE: (function () { ... })(); é uma função que se executa sozinha na
 *   hora. Serve para as variáveis internas (sem, campo...) não "vazarem" e
 *   não se misturarem com as de outros arquivos. Só o que penduramos em
 *   window.PIX fica visível lá fora.
 * - Arrow function: (s) => ... é um jeito curto de escrever uma função.
 * - Desestruturação: function payload({ tipo, chave, ... }) recebe UM objeto
 *   e já tira dele as propriedades com esses nomes.
 */
(function () {
  // sem(texto): tira acentos e símbolos que o Pix não aceita.
  // normalize('NFD') separa a letra do acento ("é" vira "e" + "´") e o
  // replace seguinte apaga os acentos soltos. Ex.: sem('São José') -> 'Sao Jose'.
  const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 .\-@]/g, '').trim();
  // campo(id, valor): monta um pedaço do código no formato ID + TAMANHO + VALOR.
  // padStart(2, '0') completa com zero à esquerda: tamanho 5 vira "05".
  const campo = (id, v) => id + String(v.length).padStart(2, '0') + v;

  // crc16(texto): calcula o "dígito verificador" de 4 letras/números exigido
  // pelo Banco Central (algoritmo CRC16-CCITT). É uma conta matemática com
  // bits (^, <<, &); você não precisa entender os detalhes: só saber que, se
  // mudar 1 letra do código, o CRC muda e o banco recusa o Pix.
  function crc16(txt) {
    let crc = 0xFFFF;
    for (let i = 0; i < txt.length; i++) {
      crc ^= txt.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  // deixa a chave no formato que o Pix aceita
  // Recebe o tipo ('cpf', 'cnpj', 'telefone', 'email' ou 'aleatoria') e a chave
  // como a pessoa digitou. Devolve a chave "limpa". Exemplos:
  //   CPF '123.456.789-00' -> '12345678900'
  //   telefone '(16) 99290-8583' -> '+5516992908583' (o Pix exige +55)
  function chaveFormatada(tipo, chave) {
    const c = String(chave || '').trim();
    if (tipo === 'cpf' || tipo === 'cnpj') return c.replace(/\D/g, '');
    if (tipo === 'telefone') { let n = c.replace(/\D/g, ''); if (!n.startsWith('55')) n = '55' + n; return '+' + n; }
    if (tipo === 'email') return c.toLowerCase();
    return c;
  }

  // payload({...}): monta o código Pix "copia e cola" completo.
  // Recebe um objeto com: tipo e chave Pix, nome e cidade de quem recebe,
  // valor (em reais, opcional), txid (identificador da cobrança) e descrição.
  // Devolve o texto enorme que começa com "000201..." e termina com o CRC.
  // Exemplo real: quando a cliente agenda e o studio cobra sinal de R$ 30,
  // o sistema chama PIX.payload({ tipo:'telefone', chave:'...', valor: 30, ... }).
  function payload({ tipo, chave, nome, cidade, valor, txid, descricao }) {
    // Campo 26 = "dados da conta": identifica que é Pix (br.gov.bcb.pix),
    // a chave (01) e, se houver, uma descrição curta (02, até 40 letras).
    const conta = campo('00', 'br.gov.bcb.pix') + campo('01', chaveFormatada(tipo, chave)) +
      (descricao ? campo('02', sem(descricao).slice(0, 40)) : '');
    // Monta o código na ordem exigida: 00 versão, 26 conta, 52 categoria,
    // 53 moeda (986 = Real), 54 valor, 58 país, 59 nome (até 25 letras),
    // 60 cidade (até 15), 62 txid. O '6304' no fim anuncia o CRC (4 caracteres).
    // Os limites com .slice() existem porque o banco recusa textos maiores.
    let p = campo('00', '01') + campo('26', conta) + campo('52', '0000') + campo('53', '986') +
      (valor ? campo('54', Number(valor).toFixed(2)) : '') + campo('58', 'BR') +
      campo('59', sem(nome).toUpperCase().slice(0, 25) || 'RECEBEDOR') +
      campo('60', sem(cidade).toUpperCase().slice(0, 15) || 'BRASIL') +
      campo('62', campo('05', (sem(txid).replace(/[^A-Za-z0-9]/g, '') || '***').slice(0, 25))) + '6304';
    return p + crc16(p);
  }

  // qrSvg(texto): transforma o código Pix em uma imagem de QR Code (formato
  // SVG, que é um desenho feito de texto e fica nítido em qualquer tamanho).
  // Se a biblioteca do QR não carregou (internet ruim), devolve '' e a tela
  // mostra só o "copia e cola". 'M' é o nível de correção de erros (médio).
  function qrSvg(texto) {
    if (!window.qrcode) return '';
    const q = window.qrcode(0, 'M'); q.addData(texto); q.make();
    return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  }

  // Publica as funções para o resto do sistema usar como window.PIX.payload(...).
  // { payload, qrSvg, crc16 } é um atalho para { payload: payload, ... }.
  window.PIX = { payload, qrSvg, crc16 };
})();
