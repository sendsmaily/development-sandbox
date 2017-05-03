import React from 'react';
import PropTypes from 'prop-types';
import TodoItem from './TodoItem';


const TodoList = ({ items, flipTodoItem }) => (
  <ul id="todo-list">
    { items.map(item => <TodoItem key={item.uuid} item={item} handleClick={flipTodoItem} />) }
  </ul>);

TodoList.defaultProps = {
  items: [],
};

TodoList.propTypes = {
  flipTodoItem: PropTypes.func.isRequired,
  items: PropTypes.arrayOf(PropTypes.shape({
    uuid: PropTypes.string.isRequired,
    body: PropTypes.string.isRequired,
    is_done: PropTypes.bool.isRequired,
    created_at: PropTypes.string.isRequired,
  })),
};

export default TodoList;
