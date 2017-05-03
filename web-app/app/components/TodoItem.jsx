import React from 'react';
import PropTypes from 'prop-types';


const TodoItem = ({ handleClick, item }) => (
  <li
    className={item.is_done ? 'completed' : ''}
    onClick={(event) => {
      event.preventDefault();
      handleClick(item);
    }}>{item.body}</li>);

TodoItem.defaultProps = {
  item: {},
};

TodoItem.propTypes = {
  handleClick: PropTypes.func.isRequired,
  item: PropTypes.shape({
    uuid: PropTypes.string.isRequired,
    body: PropTypes.string.isRequired,
    is_done: PropTypes.bool.isRequired,
    created_at: PropTypes.string.isRequired,
  }),
};

export default TodoItem;
