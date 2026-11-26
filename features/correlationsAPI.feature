Feature: API de correlação entre turmas
  As a client of the teaching assistant API
  I want to request correlations between class results
  So that the professor interface can present the calculated data

  # Estes cenários exercitam diretamente o endpoint POST /api/classes/correlation.
  # As notas são convertidas pela API para MANA=1, MPA=2 e MA=3.

  Scenario: Rejeitando uma variável que não é suportada pela API
    Given the correlation API is available
    And the class "API-2024-1" exists
    And the class "API-2024-2" exists
    When I POST "/api/classes/correlation" with:
      """
      {"classIds":["API-2024-1","API-2024-2"],"variables":["Class size","Design"]}
      """
    Then the response status is 400
    And the response error is "Select two valid variables"

  Scenario: Rejeitando uma turma que não existe
    Given the correlation API is available
    And the class "API-2024-1" exists
    When I POST "/api/classes/correlation" with:
      """
      {"classIds":["API-2024-1","API-2024-9"],"variables":["Requirements","Design"]}
      """
    Then the response status is 400
    And the response error is "One or more selected classes were not found"

  Scenario: Retornando uma lista vazia quando há menos de dois pontos de dados comuns
    Given the correlation API is available
    And the class "API-Missing-2024-1" has enrolled students with:
      | student | Requirements | Design |
      | Ana     | MANA | MANA |
    And the class "API-Missing-2024-2" exists
    When I POST "/api/classes/correlation" with:
      """
      {"classIds":["API-Missing-2024-1","API-Missing-2024-2"],"variables":["Requirements","Design"]}
      """
    Then the response status is 200
    And the response body is an empty JSON array

  Scenario: Retornando correlação fraca quando todos os resultados são idênticos
    Given the correlation API is available
    And the class "API-Constant-2024-1" has enrolled students with:
      | student | Requirements | Design |
      | Ana     | MPA | MPA |
    And the class "API-Constant-2024-2" has enrolled students with:
      | student | Requirements | Design |
      | Ana     | MPA | MPA |
    When I POST "/api/classes/correlation" with:
      """
      {"classIds":["API-Constant-2024-1","API-Constant-2024-2"],"variables":["Requirements","Design"]}
      """
    Then the response status is 200
    And the response contains one correlation result with 2 data points, coefficient 0 and interpretation "Weak or no correlation"

  Scenario: Calculando uma correlação positiva com médias agregadas por turma
    Given the correlation API is available
    And the class "API-Positive-2024-1" has enrolled students with:
      | student | Requirements | Design |
      | Ana     | MANA         | MANA   |
      | Bruno   | MA           | MA     |
    And the class "API-Positive-2024-2" has enrolled students with:
      | student | Requirements | Design |
      | Carla   | MPA          | MPA    |
      | Daniel  | MA           | MA     |
    And the class "API-Positive-2024-3" has enrolled students with:
      | student | Requirements | Design |
      | Elisa   | MA           | MA     |
      | Fabio   | MA           | MA     |
    When I POST "/api/classes/correlation" with:
      """
      {"classIds":["API-Positive-2024-1","API-Positive-2024-2","API-Positive-2024-3"],"variables":["Requirements","Design"]}
      """
    Then the response status is 200
    And the response contains one correlation result with 3 data points, coefficient 1 and interpretation "Strong positive correlation"

    # As médias de Requirements e Design por turma são [2; 2,5; 3].
    # As duas séries são iguais, então Pearson r = 1,00.

  Scenario: Calculando a correlação máxima (r = 1)
    Given the correlation API is available
    And the class "API-2024-1" has enrolled students with:
      | student | Requirements | Design |
      | Ana     | MANA         | MANA   |
    And the class "API-2024-2" has enrolled students with:
      | student | Requirements | Design |
      | Bruno   | MPA          | MPA    |
    And the class "API-2024-3" has enrolled students with:
      | student | Requirements | Design |
      | Carla   | MA           | MA     |
    When I POST "/api/classes/correlation" with:
      """
      {"classIds":["API-2024-1","API-2024-2","API-2024-3"],"variables":["Requirements","Design"]}
      """
    Then the response status is 200
    And the response contains one correlation result with 3 data points, coefficient 1 and interpretation "Strong positive correlation"

  Scenario: Calculando a correlação mínima (r = -1)
    Given the correlation API is available
    And the class "API-2024-1" has enrolled students with:
      | student | Requirements | Design |
      | Ana     | MANA         | MA     |
    And the class "API-2024-2" has enrolled students with:
      | student | Requirements | Design |
      | Bruno   | MPA          | MPA    |
    And the class "API-2024-3" has enrolled students with:
      | student | Requirements | Design |
      | Carla   | MA           | MANA   |
    When I POST "/api/classes/correlation" with:
      """
      {"classIds":["API-2024-1","API-2024-2","API-2024-3"],"variables":["Requirements","Design"]}
      """
    Then the response status is 200
    And the response contains one correlation result with 3 data points, coefficient -1 and interpretation "Strong negative correlation"

  Scenario: Calculando a correlação entre quatro turmas # par
    Given the correlation API is available
    And the class "API-2024-1" has enrolled students with:
      | student | Requirements | Design |
      | Ana     | MANA         | MANA   |
    And the class "API-2024-2" has enrolled students with:
      | student | Requirements | Design |
      | Bruno   | MPA          | MA     |
    And the class "API-2024-3" has enrolled students with:
      | student | Requirements | Design |
      | Carla   | MA           | MPA    |
    And the class "API-2024-4" has enrolled students with:
      | student | Requirements | Design |
      | Daniel  | MPA          | MA     |
    When I POST "/api/classes/correlation" with:
      """
      {"classIds":["API-2024-1","API-2024-2","API-2024-3","API-2024-4"],"variables":["Requirements","Design"]}
      """
    Then the response status is 200
    And the response contains one correlation result with 4 data points, coefficient 0.4264014327 and interpretation "Moderate positive correlation"

  Scenario: Calculando a correlação entre três turmas # ímpar
    Given the correlation API is available
    And the class "API-2024-1" has enrolled students with:
      | student | Requirements | Design |
      | Ana     | MANA         | MANA   |
    And the class "API-2024-2" has enrolled students with:
      | student | Requirements | Design |
      | Bruno   | MPA          | MA     |
    And the class "API-2024-3" has enrolled students with:
      | student | Requirements | Design |
      | Carla   | MA           | MPA    |
    When I POST "/api/classes/correlation" with:
      """
      {"classIds":["API-2024-1","API-2024-2","API-2024-3"],"variables":["Requirements","Design"]}
      """
    Then the response status is 200
    And the response contains one correlation result with 3 data points, coefficient 0.5 and interpretation "Moderate positive correlation"
