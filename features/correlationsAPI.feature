Feature: API de correlação entre turmas
  As a client of the teaching assistant API
  I want to request correlations between class results
  So that the professor interface can present the calculated data

  # Estes cenários exercitam diretamente o endpoint POST /api/classes/correlation.
  # As notas são convertidas pela API para MANA=1, MPA=2 e MA=3.

  Scenario: Rejeitando uma variável que não é suportada pela API
    Given the correlation API is available
    And the classes "API-2024-1" and "API-2024-2" exist
    When I POST "/api/classes/correlation" with:
      """
      {"classIds":["API-2024-1","API-2024-2"],"variables":["Class size","Design"]}
      """
    Then the response status is 400
    And the response error is "Select two valid variables"

  Scenario: Rejeitando uma turma que não existe
    Given the correlation API is available
    And the class "API-2024-1" exists
    And the class "API-2024-9" does not exist
    When I POST "/api/classes/correlation" with:
      """
      {"classIds":["API-2024-1","API-2024-9"],"variables":["Requirements","Design"]}
      """
    Then the response status is 400
    And the response error is "One or more selected classes were not found"

  Scenario: Retornando uma lista vazia quando há menos de dois pontos de dados comuns
    Given the correlation API is available
    And the class "API-Missing-2024-1" has one enrolled student with:
      | goal         | grade |
      | Requirements | MANA  |
      | Design       | MANA  |
    And the class "API-Missing-2024-2" has no evaluation for "Requirements" or "Design"
    When I POST "/api/classes/correlation" with:
      """
      {"classIds":["API-Missing-2024-1","API-Missing-2024-2"],"variables":["Requirements","Design"]}
      """
    Then the response status is 200
    And the response body is an empty JSON array

  Scenario: Retornando correlação fraca quando todos os resultados são idênticos
    Given the correlation API is available
    And the class "API-Constant-2024-1" has one enrolled student with:
      | goal         | grade |
      | Requirements | MPA   |
      | Design       | MPA   |
    And the class "API-Constant-2024-2" has one enrolled student with:
      | goal         | grade |
      | Requirements | MPA   |
      | Design       | MPA   |
    When I POST "/api/classes/correlation" with:
      """
      {"classIds":["API-Constant-2024-1","API-Constant-2024-2"],"variables":["Requirements","Design"]}
      """
    Then the response status is 200
    And the response contains one correlation result with:
      | firstVariable       | Requirements          |
      | firstVariableLabel   | Requirements          |
      | secondVariable      | Design                |
      | secondVariableLabel  | Design                |
      | dataPoints          | 2                     |
      | value               | 0                     |
      | interpretation      | Weak or no correlation |

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
    And the response contains one correlation result with:
      | firstVariable       | Requirements                |
      | firstVariableLabel   | Requirements                |
      | secondVariable      | Design                      |
      | secondVariableLabel  | Design                      |
      | dataPoints          | 3                           |
      | value               | 1                           |
      | interpretation      | Strong positive correlation |

    # As médias de Requirements e Design por turma são [2; 2,5; 3].
    # As duas séries são iguais, então Pearson r = 1,00.
