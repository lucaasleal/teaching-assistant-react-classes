# language: pt
@correlacao
Funcionalidade: Correlação entre turmas

  Cenário: Correlação positiva quando as avaliações variam juntas
    Dado que existem turmas com os conceitos abaixo:
      | turma   | Requirements | Design |
      | 2024.1  | MANA         | MANA   |
      | 2024.2  | MPA          | MPA    |
      | 2024.3  | MA           | MA     |
    Quando seleciono as turmas "2024.1, 2024.2, 2024.3"
    E escolho "Requirements" e "Design" como variáveis
    E peço os dados de correlação
    Então vejo uma correlação com coeficiente "1.00" e "3 turmas analisadas"
    E a frase do resultado contém "strong positive correlation"

  Cenário: Correlação negativa quando as avaliações variam em sentidos opostos
    Dado que existem turmas com os conceitos abaixo:
      | turma   | Requirements | Design |
      | 2024.1  | MANA         | MA     |
      | 2024.2  | MPA          | MPA    |
      | 2024.3  | MA           | MANA   |
    Quando seleciono as turmas "2024.1, 2024.2, 2024.3"
    E escolho "Requirements" e "Design" como variáveis
    E peço os dados de correlação
    Então vejo uma correlação com coeficiente "-1.00" e "3 turmas analisadas"
    E a frase do resultado contém "strong negative correlation"

  Cenário: Nenhuma turma selecionada
    Dado que existem turmas sem avaliações
    Quando escolho "Requirements" e "Design" como variáveis
    Então o botão de correlação fica desabilitado e não há resultado

  Cenário: Apenas uma turma selecionada
    Dado que existem turmas sem avaliações
    Quando seleciono as turmas "2024.1"
    E escolho "Requirements" e "Design" como variáveis
    Então o botão de correlação fica desabilitado e não há resultado

  Cenário: Mesma variável nos dois campos
    Dado que existem turmas sem avaliações
    Quando seleciono as turmas "2024.1, 2024.2"
    E escolho "Requirements" e "Requirements" como variáveis
    Então o botão de correlação fica desabilitado e não há resultado

  Cenário: Turmas sem avaliações suficientes
    Dado que existem turmas sem avaliações
    Quando seleciono as turmas "2024.1, 2024.2"
    E escolho "Requirements" e "Design" como variáveis
    E peço os dados de correlação
    Então vejo o aviso de dados insuficientes e não há resultado
