@comparacao
Feature: Comparação de Desempenho
  Como um professor
  Eu quero ver um gráfico do desempenho de duas ou mais turmas
  Para que eu possa compará-las em relação a uma métrica

# Serviço
@api
Scenario: Sucesso na requisição de cálculo de comparação de desempenho
  Given a disciplina "Sistemas Operacionais" está cadastrada no sistema
    And a turma "2025/1" possui notas cadastradas no sistema
    And a turma "2025/2" possui notas cadastradas no sistema
  When eu solicito ao sistema a comparação da métrica "Média" entre as turmas "2025/1" e "2025/2" da disciplina "Sistemas Operacionais"
  Then o sistema retorna o status de sucesso
    And o sistema retorna o valor "8.5" para a turma "2025/1" no JSON de resposta
    And o sistema retorna o valor "9" para a turma "2025/2" no JSON de resposta
    And as turmas "2025/1" e "2025/2" permanecem inalteradas no sistema com suas respectivas notas

@api
Scenario: Falha na requisição de cálculo de comparação por falta de parâmetros mínimos
  Given a disciplina "Banco de Dados" está cadastrada no sistema
    And a turma "2025/1" possui notas cadastradas no sistema
  When eu envio uma requisição de comparação de "Média" informando apenas a disciplina "Banco de Dados" e a turma "2025/1"
  Then o sistema rejeita a requisição e retorna um código de erro de requisição inválida
    And o sistema retorna uma mensagem de erro indicando que é necessário fornecer ao menos duas turmas no payload

@api
Scenario: Sucesso na requisição de cálculo de comparação mesmo com turma sem dados cadastrados
  Given a disciplina "Engenharia de Software e Sistemas" está cadastrada no sistema
    And a turma "2026/1" possui notas cadastradas no sistema
    And a turma "2026/2" está cadastrada no sistema sem notas avaliadas
  When eu solicito ao sistema a comparação da métrica "Média" entre as turmas "2026/1" e "2026/2" da disciplina "Engenharia de Software e Sistemas"
  Then o sistema retorna o status de sucesso
    And o sistema retorna o valor "9" para a turma "2026/1" no JSON de resposta
    And o sistema retorna o valor "N/A" para a turma "2026/2" no JSON de resposta

@api
Scenario: Falha na requisição de cálculo de comparação ao burlar regras de negócio da GUI
  Given a disciplina "Inteligência Artificial" está cadastrada no sistema
    And a disciplina "Banco de Dados" está cadastrada no sistema
    And a turma "2025/1" de "Inteligência Artificial" possui notas cadastradas no sistema
    And a turma "2025/1" de "Banco de Dados" possui notas cadastradas no sistema
  When eu envio um payload de requisição tentando comparar a turma "2025/1" de "Inteligência Artificial" diretamente com a turma "2025/1" de "Banco de Dados"
  Then o sistema intercepta a inconsistência e retorna um código de erro de entidade não processável
    And o sistema não realiza nenhum cálculo de métrica
    And o sistema retorna uma mensagem de erro indicando que só é permitida a comparação entre turmas de uma única disciplina

@api
Scenario: Sucesso na requisição de cálculo de comparação ao selecionar múltiplas métricas
  Given a disciplina "Sistemas Operacionais" está cadastrada no sistema
    And a turma "2025/1" possui notas cadastradas no sistema
    And a turma "2025/2" possui notas cadastradas no sistema
  When eu solicito ao sistema a comparação das métricas "Média" e "Número de alunos aprovados" entre as turmas "2025/1" e "2025/2" da disciplina "Sistemas Operacionais"
  Then o sistema retorna o status de sucesso
    And o sistema retorna o valor "8.5" para a média da turma "2025/1" no JSON de resposta
    And o sistema retorna o valor "9" para a média da turma "2025/2" no JSON de resposta
    And o sistema retorna o valor "2" para o número de alunos aprovados da turma "2025/1" no JSON de resposta
    And o sistema retorna o valor "1" para o número de alunos aprovados da turma "2025/2" no JSON de resposta

@api
Scenario: Falha na requisição de cálculo de comparação ao não selecionar métrica alguma
  Given a disciplina "Banco de Dados" está cadastrada no sistema
    And a turma "2025/1" possui notas cadastradas no sistema
    And a turma "2025/2" possui notas cadastradas no sistema
  When eu envio uma requisição de comparação informando as turmas "2025/1" e "2025/2" da disciplina "Banco de Dados" sem especificar uma métrica
  Then o sistema rejeita a requisição e retorna um código de erro de requisição inválida
    And o sistema retorna uma mensagem de erro indicando que é necessário selecionar ao menos uma métrica no payload

@api
Scenario: Falha na requisição de cálculo de comparação ao solicitar métrica inválida ou inexistente
  Given a disciplina "Engenharia de Software e Sistemas" está cadastrada no sistema
    And a turma "2025/2" possui notas cadastradas no sistema
    And a turma "2026/1" possui notas cadastradas no sistema
  When eu envio uma requisição de comparação informando a métrica "Taxa de Evasão" entre as turmas "2025/2" e "2026/1" da disciplina "Engenharia de Software e Sistemas"
  Then o sistema rejeita a requisição e retorna um código de erro de entidade não processável
    And o sistema retorna uma mensagem de erro indicando que a métrica solicitada não é suportada pelo sistema
    And o sistema retorna o valor "N/A" para a turma "2025/2" no JSON de resposta
    And o sistema retorna o valor "N/A" para a turma "2026/1" no JSON de resposta

# GUI
Scenario Outline: Sucesso na geração do gráfico de desempenho em cada métrica
  Given eu estou na seção "Comparação de Desempenho" da aba "Classes"
    And a disciplina "<disciplina>" existe na lista de disciplinas
    And a turma "<turma1>" possui "<valor1>" na métrica "<métrica>" e existe na lista de turmas da disciplina "<disciplina>"
    And a turma "<turma2>" possui "<valor2>" na métrica "<métrica>" e existe na lista de turmas da disciplina "<disciplina>"
  When eu seleciono a disciplina "<disciplina>"
    And eu seleciono a turma "<turma1>"
    And eu seleciono a turma "<turma2>"
    And eu seleciono a métrica "<métrica>"
    And eu solicito a geração do gráfico de desempenho
  Then eu consigo ver um gráfico de colunas com o título "<métrica>" abaixo das seleções
    And o eixo X do gráfico possui as turmas "<turma1>" e "<turma2>"
    And o eixo Y do gráfico possui o valor "<valor1>" determinando a altura da coluna da turma "<turma1>"
    And o eixo Y do gráfico possui o valor "<valor2>" determinando a altura da coluna da turma "<turma2>"
  Examples:
  | métrica                               | disciplina                                 | turma1 | turma2 | valor1 | valor2 |
  | Média                                 | Engenharia de Software e Sistemas          | 2024/1 | 2024/2 | 8.4    | 7.8    |
  | Número de alunos aprovados            | Sinais e Sistemas para Computação          | 2025/2 | 2026/1 | 42     | 37     |
  | Número de alunos aprovados por nota   | Eletrônica para Computação                 | 2024/2 | 2025/1 | 5      | 4      |
  | Número de alunos reprovados por nota  | Fundamentos de Redes de Computadores       | 2025/2 | 2026/1 | 1      | 3      |
  | Número de alunos reprovados por falta | Complementos da Matemática para Computação | 2025/2 | 2026/1 | 2      | 0      |

Scenario: Sucesso na geração do gráfico de desempenho ao selecionar múltiplas turmas
  Given eu estou na seção "Comparação de Desempenho" da aba "Classes"
    And a disciplina "Teoria da Computação" existe na lista de disciplinas
    And a turma "2024/1" possui "5" na métrica "Número de alunos aprovados por nota" e existe na lista de turmas da disciplina "Teoria da Computação"
    And a turma "2024/2" possui "2" na métrica "Número de alunos aprovados por nota" e existe na lista de turmas da disciplina "Teoria da Computação"
    And a turma "2025/1" possui "1" na métrica "Número de alunos aprovados por nota" e existe na lista de turmas da disciplina "Teoria da Computação"
    And a turma "2025/2" possui "7" na métrica "Número de alunos aprovados por nota" e existe na lista de turmas da disciplina "Teoria da Computação"
  When eu seleciono a disciplina "Teoria da Computação"
    And eu seleciono a turma "2024/1"
    And eu seleciono a turma "2024/2"
    And eu seleciono a turma "2025/1"
    And eu seleciono a turma "2025/2"
    And eu seleciono a métrica "Número de alunos aprovados por nota"
    And eu solicito a geração do gráfico de desempenho
  Then eu consigo ver um gráfico de colunas com o título "Número de alunos aprovados por nota" abaixo das seleções
    And o eixo X do gráfico possui as turmas "2024/1", "2024/2", "2025/1" e "2025/2"
    And o eixo Y do gráfico possui o valor "5" determinando a altura da coluna da turma "2024/1"
    And o eixo Y do gráfico possui o valor "2" determinando a altura da coluna da turma "2024/2"
    And o eixo Y do gráfico possui o valor "1" determinando a altura da coluna da turma "2025/1"
    And o eixo Y do gráfico possui o valor "7" determinando a altura da coluna da turma "2025/2"

Scenario: Sucesso na geração do gráfico de desempenho ao selecionar múltiplas métricas
  Given eu estou na seção "Comparação de Desempenho" da aba "Classes"
    And a disciplina "Sistemas Operacionais" existe na lista de disciplinas
    And a turma "2025/1" possui "8.1" de média, "58" alunos aprovados e existe na lista de turmas da disciplina "Sistemas Operacionais"
    And a turma "2025/2" possui "9.0" de média, "47" alunos aprovados e existe na lista de turmas da disciplina "Sistemas Operacionais"
  When eu seleciono a disciplina "Sistemas Operacionais"
    And eu seleciono a turma "2025/1"
    And eu seleciono a turma "2025/2"
    And eu seleciono a métrica "Média"
    And eu seleciono a métrica "Número de alunos aprovados"
    And eu solicito a geração do gráfico de desempenho
  Then eu consigo ver um gráfico de colunas com o título "Média" abaixo das seleções
    And eu consigo ver um gráfico de colunas com o título "Número de alunos aprovados" abaixo do primeiro gráfico
    And o eixo X de ambos os gráficos possui as turmas "2025/1" e "2025/2"
    And o eixo Y do gráfico "Média" possui o valor "8.1" determinando a altura da coluna da turma "2025/1"
    And o eixo Y do gráfico "Média" possui o valor "9" determinando a altura da coluna da turma "2025/2"
    And o eixo Y do gráfico "Número de alunos aprovados" possui o valor "58" determinando a altura da coluna da turma "2025/1"
    And o eixo Y do gráfico "Número de alunos aprovados" possui o valor "47" determinando a altura da coluna da turma "2025/2"

Scenario: Sucesso na geração do gráfico de desempenho mesmo selecionando turma sem dados cadastrados
  Given eu estou na seção "Comparação de Desempenho" da aba "Classes"
    And a disciplina "Introdução à Computação" existe na lista de disciplinas
    And a turma "2024/1" possui "9.8" na métrica "Média" e existe na lista de turmas da disciplina "Introdução à Computação"
    And a turma "2024/2" possui "9.4" na métrica "Média" e existe na lista de turmas da disciplina "Introdução à Computação"
    And a turma "2025/1" não possui dados cadastrados e existe na lista de turmas da disciplina "Introdução à Computação"
  When eu seleciono a disciplina "Introdução à Computação"
    And eu seleciono a turma "2024/1"
    And eu seleciono a turma "2024/2"
    And eu seleciono a turma "2025/1"
    And eu seleciono a métrica "Média"
    And eu solicito a geração do gráfico de desempenho
  Then eu consigo ver um gráfico de colunas com o título "Média" abaixo das seleções
    And o eixo X do gráfico possui as turmas "2024/1" e "2024/2"
    And o eixo Y do gráfico possui o valor "9.8" determinando a altura da coluna da turma "2024/1"
    And o eixo Y do gráfico possui o valor "9.4" determinando a altura da coluna da turma "2024/2"
    And eu consigo ver uma mensagem de aviso afirmando que a turma "2025/1" não possui dados cadastrados

Scenario: Falha na geração do gráfico de desempenho ao selecionar apenas uma turma
  Given eu estou na seção "Comparação de Desempenho" da aba "Classes"
    And a disciplina "Banco de Dados" existe na lista de disciplinas
    And a turma "2025/1" possui "9.4" na métrica "Média" e existe na lista de turmas da disciplina "Banco de Dados"
  When eu seleciono a disciplina "Banco de Dados"
    And eu seleciono a turma "2025/1"
    And eu seleciono a métrica "Média"
    And eu solicito a geração do gráfico de desempenho
  Then o sistema não exibe o gráfico de desempenho
    And eu consigo ver uma mensagem de erro solicitando a seleção de ao menos 2 turmas

Scenario: Falha na geração do gráfico de desempenho ao não selecionar disciplina alguma
  Given eu estou na seção "Comparação de Desempenho" da aba "Classes"
  When eu seleciono a métrica "Número de alunos aprovados"
    And eu solicito a geração do gráfico de desempenho
  Then o sistema não permite selecionar turmas
    And o sistema não exibe o gráfico de desempenho
    And eu consigo ver uma mensagem de erro solicitando a seleção de uma disciplina

Scenario: Falha na geração do gráfico de desempenho ao não selecionar turma alguma
  Given eu estou na seção "Comparação de Desempenho" da aba "Classes"
    And a disciplina "Laboratório de Eletrônica" existe na lista de disciplinas
  When eu seleciono a disciplina "Laboratório de Eletrônica"
    And eu seleciono a métrica "Número de alunos reprovados por nota"
    And eu solicito a geração do gráfico de desempenho
  Then o sistema não exibe o gráfico de desempenho
    And eu consigo ver uma mensagem de erro solicitando a seleção de ao menos 2 turmas

Scenario: Falha na geração do gráfico de desempenho ao não selecionar métrica alguma
  Given eu estou na seção "Comparação de Desempenho" da aba "Classes"
    And a disciplina "Engenharia de Software e Sistemas" existe na lista de disciplinas
    And a turma "2025/2" existe na lista de turmas da disciplina "Engenharia de Software e Sistemas"
    And a turma "2026/1" existe na lista de turmas da disciplina "Engenharia de Software e Sistemas"
  When eu seleciono a disciplina "Engenharia de Software e Sistemas"
  And eu seleciono a turma "2025/2"
  And eu seleciono a turma "2026/1"
  And eu solicito a geração do gráfico de desempenho
  Then o sistema não exibe o gráfico de desempenho
  And eu consigo ver uma mensagem de erro solicitando a seleção de ao menos 1 métrica

Scenario: Falha na geração do gráfico de desempenho ao selecionar turma sem dados cadastrados
  Given eu estou na seção "Comparação de Desempenho" da aba "Classes"
    And a disciplina "Engenharia de Software e Sistemas" existe na lista de disciplinas
    And a turma "2025/2" possui dados cadastrados e existe na lista de turmas da disciplina "Engenharia de Software e Sistemas"
    And a turma "2026/1" não possui dados cadastrados e existe na lista de turmas da disciplina "Engenharia de Software e Sistemas"
  When eu seleciono a disciplina "Engenharia de Software e Sistemas"
    And eu seleciono a turma "2025/2"
    And eu seleciono a turma "2026/1"
    And eu seleciono a métrica "Média"
    And eu solicito a geração do gráfico de desempenho
  Then o sistema não exibe o gráfico de desempenho
  And eu consigo ver uma mensagem de aviso afirmando que a turma "2026/1" não possui dados cadastrados

Scenario: Comportamento ao selecionar uma turma já selecionada
  Given eu estou na seção "Comparação de Desempenho" da aba "Classes"
    And a disciplina "Lógica para Computação" existe na lista de disciplinas
    And a turma "2026/1" existe na lista de turmas da disciplina "Lógica para Computação"
  When eu seleciono a disciplina "Lógica para Computação"
  And eu seleciono a turma "2026/1"
  And eu seleciono novamente a turma "2026/1"
  Then o sistema remove a seleção da turma "2026/1"

Scenario: Comportamento ao selecionar uma disciplina diferente da já selecionada
  Given eu estou na seção "Comparação de Desempenho" da aba "Classes"
    And a disciplina "Introdução à Programação" existe na lista de disciplinas
    And a disciplina "Aprendizado de Máquina" existe na lista de disciplinas
    And a disciplina "Introdução à Programação" está selecionada
  When eu seleciono a disciplina "Aprendizado de Máquina"
  Then o sistema remove a seleção da disciplina "Introdução à Programação"
    And o sistema mantém a disciplina "Aprendizado de Máquina" selecionada